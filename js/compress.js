import { encodePBuf } from "./protobuf/converters-common.js"

import { genUUID, HNWProtocolVersionNumber, typeIsOOB } from "./common.js"
import { HNWRTC } from "./webrtc.js"
import { HNWWS  } from "./websocket.js"

let lastSentIDMap = {}; // Object[String, UUID]

// (Protocol.Channel) => String
const toBaseID = (channel) => channel.url || channel.id;

// (String) => UUID
const extractLastSentID = (channelID) => {
  const lsid = lastSentIDMap[channelID];
  if (lsid !== undefined) {
    return lsid;
  } else {
    const nullary = '00000000-0000-0000-0000-000000000000';
    lastSentIDMap[channelID] = nullary;
    return nullary;
  }
}

// A dummy... for now.  I'll bring in the proper library later. --JAB (7/29/19)
const pako = {
  deflate: ((x) => x)
, inflate: ((x) => x)
};

// (Any) => String
const compress = (data) => {
  return pako.deflate(data, { to: '???' });
};

// (String, Number) => Array[String]
const chunk = (arr, length) => {
  const baseArray = Array.from(Array(Math.ceil(arr.length / length)));
  return baseArray.map((x, i) => arr.slice(length * i, length * (i + 1)));
};

// (String) => Any
const decompress = (deflated) => {
  return pako.inflate(deflated, { to: '???' });
};

// (Array[_]) => Array[Array[U]]
const chunkForSending = (message) => {

  const chunkSize  = 2400;
  const compressed = compress(message);
  const messages   = chunk(compressed, chunkSize);

  if (messages.length * chunkSize <= 2e7)
    return messages;
  else
    throw new Error('This activity is generating too much data for HubNet Web to reliably transfer.  Aborting....');

};

let encoderPool = new Worker('js/protobuf/encoder-pool.js');

encoderPool.onmessage = (msg) => {
  switch (msg.type) {
    case "shutdown-complete":
      break;
    default:
      console.warn("Unknown encoder pool response type:", e.type, e)
  }
};

let decoderPool = new Worker('js/protobuf/decoder-pool.js');

decoderPool.onmessage = (msg) => {
  switch (msg.type) {
    case "shutdown-complete":
      break;
    default:
      console.warn("Unknown decoder pool response type:", e.type, e)
  }
};

// (WebWorker, Object[Any]) => Promise[Any]
const awaitWorker = (worker, msg) => {

  const f =
    (resolve, reject) => {

      const channel = new MessageChannel();

      channel.port1.onmessage = ({ data }) => {
        channel.port1.close();
        resolve(data);
      };

      worker.postMessage(msg, [channel.port2]);

    };

  return new Promise(f);

}

// (Object[Any], Boolean) => Promise[Any]
const asyncEncode = (parcel, isHost) => {
  if (isHost) {
    return awaitWorker(encoderPool, { type: "encode", parcel });
  } else {
    return new Promise((res, rej) => res(encodePBuf(false)(parcel)));
  }
};

// (Boolean, Protocol.Channel) => (String, Any, Boolean, UUID, UUID) => Unit
const _send = (isHost, channel) => (type, obj, needsPred = true, predecessorID = extractLastSentID(channel), id = genUUID()) => {

  const clone = Object.assign({}, obj);
  delete clone[id];
  delete clone[predecessorID];

  const finalObj = Object.assign({}, { id }, needsPred ? { predecessorID } : {}, clone);

  if (channel instanceof WebSocket) {
    const finalStr = makeMessage(type, finalObj);
    channel.send(finalStr);
  } else {
    const parcel = { type, ...finalObj };
    console.log(parcel);
    asyncEncode(parcel, isHost).then((encoded) => channel.send(encoded));
  }

  lastSentIDMap[channel.url] = id;

};

// (Boolean) => (Protocol.Channel) => (String, Any) => Unit
const send = (isHost) => (channel) => (type, obj) => {
  _send(isHost, channel)(type, obj);
};

// (Boolean, Protocol.Channel) => (String, Any, Boolean) => Unit
const sendOOB = (isHost, channel) => (type, obj) => {
  if (channel instanceof WebSocket) {
    const finalStr = makeMessage(type, obj);
    channel.send(finalStr);
  } else {
    asyncEncode({ type, ...obj }, isHost).then(
      (encoded) => {
        channel.send(encoded);
      }
    );
  }
}

// (Boolean, Protocol.Channel*) => (String, Any) => Unit
const sendBurst = (isHost, ...channels) => (type, obj) => {

  asyncEncode({ type, ...obj }, isHost).then(
    (encoded) => {

      const chunks = chunkForSending(encoded);

      const id = genUUID();

      let objs = chunks.map((m, index) => ({ index, fullLength: chunks.length, parcel: m }));

      channels.forEach((channel) => {
        objs.forEach((obj, index) => {
          channels.forEach((channel) => _send(isHost, channel)("hnw-burst", obj, index === 0, undefined, id));
        });
      });

    }
  );

};

// (Protocol.StatusBundle) => (Boolean) => (Protocol.Channel*) => (String, Object[Any]) => Unit
const sendObj = (statusBundle) => (isHost) => (...channels) => (type, obj) => {
  channels.forEach((channel) => {
    switch (channel.readyState) {
      case statusBundle.connecting:
        setTimeout(() => { sendObj(statusBundle)(isHost)(channel)(type, obj); }, 50);
        break;
      case statusBundle.closing:
      case statusBundle.closed:
        console.warn(`Cannot send '${type}' message over connection, because it is already closed`, channel, obj);
        break;
      case statusBundle.open:
        if (typeIsOOB(type)) {
          sendOOB(isHost, channel)(type, obj);
        } else {
          send(isHost)(channel)(type, obj);
        }
        break;
      default:
        console.warn(`Unknown connection ready state: ${channel.readyState}`);
    }
  });
};

// (Boolean) => (Protocol.Channel, Protocol.StatusBundle) => Unit
const sendGreeting = (isHost) => (channel, statusBundle) => {
  switch (channel.readyState) {
    case statusBundle.connecting:
      setTimeout(() => { sendGreeting(isHost)(channel, statusBundle); }, 50);
      break;
    case statusBundle.closing:
    case statusBundle.closed:
      console.warn(`Cannot send 'connect-established' message, because connection is already closed`);
      break;
    case statusBundle.open:
      _send(isHost, channel)("connection-established", { protocolVersion: HNWProtocolVersionNumber }, true, '00000000-0000-0000-0000-000000000000');
      break;
    default:
      console.warn(`Unknown connection ready state: ${channel.readyState}`);
  }
};

// (WebSocket*) => (Boolean) => (String, Object[Any]) => Unit
const sendWS = sendObj(HNWWS.status);

// (RTCDataChannel*) => (Boolean) => (String, Object[Any]) => Unit
const sendRTC = sendObj(HNWRTC.status);

// (String, Object[Any]) => Unit
const makeMessage = (type, obj) => {
  return JSON.stringify({ type, ...obj });
}

export { decoderPool, decompress, encoderPool, sendBurst, sendGreeting, sendObj, sendOOB, sendRTC, sendWS }

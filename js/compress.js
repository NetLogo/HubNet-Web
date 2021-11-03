import { encodePBuf } from "./protobuf/converters-common.js";

import { awaitWorker, HNWProtocolVersionNumber, typeIsOOB } from "./common.js";

import { logEntry  } from "./bandwidth-monitor.js";
import { genNextID } from "./id-manager.js";

// (String, Number) => Array[String]
const chunk = (arr, length) => {
  const baseArray = Array.from(Array(Math.ceil(arr.length / length)));
  return baseArray.map((x, i) => arr.slice(length * i, length * (i + 1)));
};

// (Array[_]) => Array[Array[U]]
const chunkForSending = (message) => {

  const chunkSize  = 15500;
  const messages   = chunk(message, chunkSize);

  if (messages.length * chunkSize <= 2e7)
    return messages;
  else
    throw new Error("This activity is generating too much data for HubNet Web to reliably transfer.  Aborting....");

};

const encoderPool = new Worker("js/protobuf/encoder-pool.js");

encoderPool.onmessage = (msg) => {
  switch (msg.type) {
    case "shutdown-complete":
      break;
    default:
      console.warn("Unknown encoder pool response type:", e.type, e);
  }
};

const decoderPool = new Worker("js/protobuf/decoder-pool.js");

decoderPool.onmessage = (msg) => {
  switch (msg.type) {
    case "shutdown-complete":
      break;
    default:
      console.warn("Unknown decoder pool response type:", e.type, e);
  }
};

// (Object[Any], Boolean) => Promise[Any]
const asyncEncode = (parcel, isHost) => {
  return isHost ? awaitWorker(encoderPool, { type: "encode", parcel }) :
                  new Promise((res, rej) => res(encodePBuf(false)(parcel)));
};

// (Boolean, RTCDataChannel) => (String, Any, UUID) => Unit
const send = (isHost, channel) => (type, obj, id = genChanID(channel)) => {

  const parcel = { ...obj };
  parcel.id    = id;

  parcel.type = type;
  asyncEncode(parcel, isHost).then((encoded) => logAndSend(encoded, channel));

};

// (Boolean, RTCDataChannel) => (String, Any) => Unit
const sendOOB = (isHost, channel) => (type, obj) => {
  asyncEncode({ type, ...obj }, isHost).then(
    (encoded) => {
      logAndSend(encoded, channel);
    }
  );
};

// (Boolean, RTCDataChannel*) => (String, Any) => Unit
const sendBurst = (isHost, ...channels) => (type, obj) => {

  // Log the IDs right away, before we do anything async, lest message IDs get
  // out of order. --Jason B. (10/16/21)
  const idMap = new Map(channels.map((channel) => [channel, genChanID(channel)]));

  asyncEncode({ type, ...obj }, isHost).then(
    (encoded) => {

      const chunks = chunkForSending(encoded);

      const objs =
        chunks.map(
          (m, index) => ({ index, fullLength: chunks.length, parcel: m })
        );

      objs.forEach((obj, index) => {
        channels.forEach((channel) => {
          const id = idMap.get(channel);
          send(isHost, channel)("hnw-burst", obj, id);
        });
      });

    }
  );

};

// (Boolean) => (RTCDataChannel*) => (String, Object[Any]) => Unit
const sendRTC = (isHost) => (...channels) => (type, obj) => {
  channels.forEach((channel) => {
    switch (channel.readyState) {
      case "connecting":
        setTimeout(() => { sendRTC(isHost)(channel)(type, obj); }, 50);
        break;
      case "closing":
      case "closed":
        console.warn(`Cannot send '${type}' message over connection, because it is already closed`, channel, obj);
        break;
      case "open":
        if (typeIsOOB(type)) {
          sendOOB(isHost, channel)(type, obj);
        } else {
          send(isHost, channel)(type, obj);
        }
        break;
      default:
        console.warn(`Unknown connection ready state: ${channel.readyState}`);
    }
  });
};

// (Boolean) => (RTCDataChannel) => Unit
const sendGreeting = (isHost) => (channel) => {
  switch (channel.readyState) {
    case "connecting":
      setTimeout(() => { sendGreeting(isHost)(channel); }, 50);
      break;
    case "closing":
    case "closed":
      console.warn("Cannot send 'connect-established' message, because connection is already closed");
      break;
    case "open":
      const baseMsg = { protocolVersion: HNWProtocolVersionNumber };
      send(isHost, channel)("connection-established", baseMsg);
      break;
    default:
      console.warn(`Unknown connection ready state: ${channel.readyState}`);
  }
};

// (Sendable, RTCDataChannel) => Unit
const logAndSend = (data, channel) => {
  logEntry(data, channel);
  channel.send(data);
};

const genChanID = (channel) => genNextID(`${channel.label}-${channel.id}`);

export { decoderPool, encoderPool, sendBurst, sendGreeting, sendOOB, sendRTC };

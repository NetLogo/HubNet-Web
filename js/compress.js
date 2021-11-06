import { HNWProtocolVersionNumber, typeIsOOB } from "./common.js";

import { logEntry     } from "./bandwidth-monitor.js";
import { genNextID    } from "./id-manager.js";
import { awaitEncoder } from "./pool-party.js";

// (Array[_]) => Array[Array[U]]
const chunkForSending = (message) => {

  const chunkSize = 15500;
  const chunks    = Array.from(Array(Math.ceil(message.length / chunkSize)));

  const messages =
    chunks.map((x, i) => message.slice(chunkSize * i, chunkSize * (i + 1)));

  if (messages.length * chunkSize <= 2e7)
    return messages;
  else
    throw new Error("This activity is generating too much data for HubNet Web to reliably transfer.  Aborting....");

};

// (Object[Any], Boolean) => Promise[Any]
const asyncEncode = (parcel, isHost) => {
  return isHost ? awaitEncoder("encode", { parcel }) :
                  new Promise((resolve) => resolve(encodePBuf(false)(parcel)));
};

// (Boolean, RTCDataChannel) => (String, Any, UUID) => Unit
const send = (isHost, channel) => (type, obj, id = genChanID(channel)) => {
  const parcel = { ...obj, id, type };
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
const sendBurst = (isHost, ...channels) => (type, msg) => {

  // Log the IDs right away, before we do anything async, lest message IDs get
  // out of order. --Jason B. (10/16/21)
  const idMap = new Map(channels.map((channel) => [channel, genChanID(channel)]));

  asyncEncode({ type, ...msg }, isHost).then(
    (encoded) => {

      const chunks = chunkForSending(encoded);

      const objs =
        chunks.map(
          (m, index) => ({ index, fullLength: chunks.length, parcel: m })
        );

      objs.forEach((obj) => {
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
      case "connecting": {
        setTimeout(() => { sendRTC(isHost)(channel)(type, obj); }, 50);
        break;
      }
      case "closing":
      case "closed": {
        console.warn(`Cannot send '${type}' message over connection, because it is already closed`, channel, obj);
        break;
      }
      case "open": {
        if (typeIsOOB(type)) {
          sendOOB(isHost, channel)(type, obj);
        } else {
          send(isHost, channel)(type, obj);
        }
        break;
      }
      default: {
        console.warn(`Unknown connection ready state: ${channel.readyState}`);
      }
    }
  });
};

// (Boolean) => (RTCDataChannel) => Unit
const sendGreeting = (isHost) => (channel) => {
  const baseMsg = { protocolVersion: HNWProtocolVersionNumber };
  sendRTC(isHost)(channel)("connection-established", baseMsg);
};

// (Sendable, RTCDataChannel) => Unit
const logAndSend = (data, channel) => {
  logEntry(data, channel);
  channel.send(data);
};

// (Channel) => Number
const genChanID = (channel) => genNextID(`${channel.label}-${channel.id}`);

export { sendBurst, sendGreeting, sendOOB, sendRTC };

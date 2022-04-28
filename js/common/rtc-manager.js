import { typeIsOOB } from "./util.js";

import SerializerPoolParty from "/js/serialize/serializer-pool-party.js";

import { version } from "/js/static/version.js";

import BandwidthMonitor from "./bandwidth-monitor.js";
import IDManager        from "./id-manager.js";

export default class RTCManager {

  #bandMon    = undefined; // BandwidthMonitor
  #idMan      = undefined; // IDManager
  #isHost     = undefined; // Boolean
  #serializer = undefined; // SerializerPoolParty

  constructor(isHost) {
    this.#bandMon    = new BandwidthMonitor();
    this.#idMan      = new IDManager();
    this.#isHost     = isHost;
    this.#serializer = new SerializerPoolParty();
  }

  // () => Number
  getBandwidth = () => {
    return this.#bandMon.getBandwidth();
  };

  // () => Number
  getNewSend = () => {
    return this.#bandMon.getNewSend();
  };

  // () => Unit
  notifyClientConnect = () => {
    this.#serializer.notifyClientConnect();
  };

  // (RTCDataChannel) => Unit
  notifyChannelDisconnect = (channel) => {
    this.#idMan.unregister(this.#chanToIdent(channel));
    this.#serializer.notifyClientDisconnect();
  };

  // (RTCDataChannel*) => (String, Object[Any]?) => Unit
  send = (...channels) => (type, obj = {}) => {

    channels.forEach((channel) => {

      switch (channel.readyState) {

        case "connecting": {
          setTimeout(() => { this.send(channel)(type, obj); }, 5);
          break;
        }

        case "closing":
        case "closed": {
          console.warn(`Cannot send '${type}' message over connection, because it is already closed`, channel, obj);
          break;
        }

        case "open": {
          if (typeIsOOB(type)) {
            this.#sendOOB(channel)(type, obj);
          } else {
            this.#send(channel)(type, obj);
          }
          break;
        }

        default: {
          console.warn("Unknown connection ready state:", channel.readyState);
        }

      }
    });
  };

  // (RTCDataChannel*) => (String, Any) => Unit
  sendBurst = (...channels) => (type, msg) => {

    // Log the IDs right away, before we do anything async, lest message IDs get
    // out of order. --Jason B. (10/16/21)
    const idMap = new Map(
      channels.map(
        (channel) => [channel, this.#genChanID(channel)]
      )
    );

    const fullMsg    = { type, ...msg };
    const jsonLength = JSON.stringify(fullMsg).length;

    if (jsonLength <= chunkSize) {
      channels.forEach((channel) => {
        const id = idMap.get(channel);
        this.#asyncSerialize({ ...fullMsg, microBurstID: id }).then(
          (microBurst) => this.#logAndSend(microBurst, channel)
        );
      });
    } else {

      this.#asyncSerialize(fullMsg).then(
        (serialized) => {

          const chunks = chunkForSending(serialized);

          const objs =
            chunks.map(
              (m, index) => ({ index, fullLength: chunks.length, parcel: m })
            );

          objs.forEach((obj) => {
            channels.forEach((channel) => {
              const id = idMap.get(channel);
              this.#send(channel)("hnw-burst", obj, id);
            });
          });

        }
      );

    }

  };

  // (RTCDataChannel) => Unit
  sendGreeting = (channel) => {
    const baseMsg = { protocolVersion: version };
    this.send(channel)("connection-established", baseMsg);
  };

  // (Object[Any]) => Promise[Any]
  #asyncSerialize = (parcel) => {
    return this.#serializer.await(this.#isHost, parcel);
  };

  // (RTCDataChannel) => String
  #chanToIdent = (channel) => {
    return `${channel.label}-${channel.id}`;
  };

  // (RTCDataChannel) => Number
  #genChanID = (channel) => {
    return this.#idMan.next(this.#chanToIdent(channel));
  };

  // (Sendable, RTCDataChannel) => Unit
  #logAndSend = (data, channel) => {
    this.#bandMon.log(data, channel);
    if (channel.readyState === "open") {
      channel.send(data);
    } else {
      console.warn("Channel no longer open.  Dropping message!", data, channel);
    }
  };

  // (RTCDataChannel) => (String, Any, UUID) => Unit
  #send = (channel) => (type, obj, id = this.#genChanID(channel)) => {
    const parcel = { ...obj, id, type };
    this.#asyncSerialize(parcel).then(
      (serialized) => this.#logAndSend(serialized, channel)
    );
  };

  // (RTCDataChannel) => (String, Any) => Unit
  #sendOOB = (channel) => (type, obj) => {
    this.#asyncSerialize({ type, ...obj }).then(
      (serialized) => {
        this.#logAndSend(serialized, channel);
      }
    );
  };

}

// (Array[_]) => Array[Array[U]]
const chunkForSending = (message) => {

  const chunks = Array.from(Array(Math.ceil(message.length / chunkSize)));

  const messages =
    chunks.map((x, i) => message.slice(chunkSize * i, chunkSize * (i + 1)));

  if (messages.length * chunkSize <= 2e7)
    return messages;
  else
    throw new Error("This activity is generating too much data for HubNet Web to reliably transfer.  Aborting....");

};

// Number
const chunkSize = 15500;

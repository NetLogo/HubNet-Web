import { typeIsOOB } from "./util.js";

import BandwidthMonitor from "./bandwidth-monitor.js";
import IDManager        from "./id-manager.js";

// (String, Object[Any]) => Unit
const makeMessage = (type, obj) => JSON.stringify({ type, ...obj });

export default class WebSocketManager {

  #bandMon   = undefined; // BandwidthMonitor
  #genNextID = undefined; // () => Number
  #socket    = undefined; // WebSocket
  #timeoutID = undefined; // Number

  // (String, (Object[Any]) => Unit, ((WebSocketManager) => Unit)?) => WebSocketManager
  constructor(url, onmessage = () => {}, onopen = () => {}) {

    this.#bandMon          = new BandwidthMonitor();
    this.#socket           = new WebSocket(url);
    this.#socket.onmessage = onmessage;
    this.#socket.onopen    = onopen(this);
    this.#refreshKeepAlive();

    this.#genNextID = (
      () => {
        const idMan = new IDManager();
        return () => idMan.next(url);
      }
    )();

  }

  // (Number, String) => Unit
  close = (exitCode, reason) => {
    this.#socket.close(exitCode, reason);
  };

  // () => Number
  getBandwidth = () => {
    return this.#bandMon.getBandwidth();
  };

  // () => Number
  getNewSend = () => {
    return this.#bandMon.getNewSend();
  };

  // (String, Object[Any]) => Unit
  send = (type, obj) => {

    const socket = this.#socket;

    switch (socket.readyState) {

      case WebSocket.CONNECTING: {
        setTimeout(() => { this.send(type, obj); }, 5);
        break;
      }

      case WebSocket.CLOSING:
      case WebSocket.CLOSED: {
        const s = `Cannot send '${type}' message over WebSocket, because it is already closed`;
        console.warn(s, socket, obj);
        break;
      }

      case WebSocket.OPEN: {
        if (typeIsOOB(type)) {
          this.#sendOOB(type, obj);
        } else {
          this.#send(type, obj);
        }
        break;
      }

      default: {
        console.warn("Unknown WebSocket ready state:", socket.readyState);
      }

    }

  };

  // (Sendable) => Unit
  #logAndSend = (data) => {
    this.#bandMon.log(data, this.#socket);
    this.#socket.send(data);
    this.#refreshKeepAlive();
  };

  // () => Unit
  #refreshKeepAlive = () => {

    if (this.#timeoutID !== null) {
      clearTimeout(this.#timeoutID);
    }

    this.#timeoutID =
      setTimeout(() => {
        if (this.#socket?.readyState === WebSocket.OPEN) {
          this.send("keep-alive", {});
        }
      }, 30000);

  };

  // (String, Any, UUID) => Unit
  #send = (type, obj, id = this.#genNextID()) => {

    const parcel = { ...obj };
    parcel.id    = id;

    const finalStr = makeMessage(type, parcel);
    this.#logAndSend(finalStr);

  };

  // (String, Any) => Unit
  #sendOOB = (type, obj) => {
    const finalStr = makeMessage(type, obj);
    this.#logAndSend(finalStr);
  };

}

import { logEntry  } from "./bandwidth-monitor.js";
import { typeIsOOB } from "./common.js";
import { genNextID } from "./id-manager.js";

let socket = null; // WebSocket

let timeoutID = null; // Number

// (String, Object[Any]) => Unit
const makeMessage = (type, obj) => JSON.stringify({ type, ...obj });

// (Sendable) => Unit
const logAndSend = (data) => {
  logEntry(data, socket);
  socket.send(data);
  refreshKeepAlive();
};

// (String, Any, UUID) => Unit
const send = (type, obj, id = genNextID(socket.url)) => {

  const parcel = { ...obj };
  parcel.id    = id;

  const finalStr = makeMessage(type, parcel);
  logAndSend(finalStr);

};

// (String, Any) => Unit
const sendOOB = (type, obj) => {
  const finalStr = makeMessage(type, obj);
  logAndSend(finalStr);
};

// (String, Object[Any]) => Unit
const sendObj = (type, obj) => {
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      setTimeout(() => { sendObj(type, obj); }, 50);
      break;
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      console.warn(`Cannot send '${type}' message over WebSocket, because it is already closed`, channel, obj);
      break;
    case WebSocket.OPEN:
      if (typeIsOOB(type)) {
        sendOOB(type, obj);
      } else {
        send(type, obj);
      }
      break;
    default:
      console.warn(`Unknown WebSocket ready state: ${socket.readyState}`);
  }
};

// () => Unit
const refreshKeepAlive = () => {

  if (timeoutID !== null) {
    clearTimeout(timeoutID);
  }

  timeoutID =
    setTimeout(() => {
      const isDefined = socket.url !== undefined;
      const isOpen    = socket.readyState === WebSocket.OPEN;
      if (isDefined && isOpen) {
        sendObj("keep-alive", {});
      }
    }, 30000);

};

// () => WebSocket
const getSocket = () => socket;

// (WebSocket) => Unit
const setSocket = (s) => {
  socket = s;
  refreshKeepAlive();
};

export { getSocket, sendObj, setSocket };

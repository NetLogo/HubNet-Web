// (String) => String
const stringToHash = (str) => {
  return Array.from(str).map((x) => x.codePointAt(0)).reduce(((acc, x) => (((acc << 5) - acc) + x) | 0), 0);
};

// (String) => Number
const uuidToRTCID = (uuid) => {
  // The docs say that the limit on the number of channels is 65534,
  // but Chromium barfs if the ID is 1024 or higher --JAB (7/15/19)
  return Math.abs(stringToHash(uuid)) % 1024;
};

const commonConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const   hostConfig = { ...commonConfig };
const joinerConfig = { ...commonConfig };

// (String, Object[Any]) => Unit
const makeMessage = (type, obj) => {
  return JSON.stringify({ type, ...obj });
}

// (WebSocket, String, Any, Boolean) => Unit
const sendObj = (...sockets) => (type, obj, isOOB) => {
  sockets.forEach((socket) => {
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        setTimeout(() => { sendObj(socket)(type, obj, isOOB); }, 50);
        break;
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        console.warn(`Cannot send '${type}' message to WebSocket, because it is already closed`, type);
        break;
      case WebSocket.OPEN:
        if (isOOB) {
          sendOOB(socket)(type, obj);
        } else {
          send(socket)(type, obj);
        }
        break;
      default:
        console.warn(`Unknown WebSocket ready state: ${socket.readyState}`);
    }
  });
};

// (RTCDataChannel*) => (String, Object[Any], Boolean) => Unit
const sendRTC = (...channels) => (type, obj, isOOB) => {
  channels.forEach((channel) => {
    switch (channel.readyState) {
      case "connecting":
        setTimeout(() => { sendRTC(channel)(type, obj, isOOB); }, 50);
        break;
      case "closing":
      case "closed":
        console.warn(`Cannot send '${type}' message over RTC, because the connection is already closed`, channel, obj);
        break;
      case "open":
        if (isOOB) {
          sendOOB(channel)(type, obj);
        } else {
          send(channel)(type, obj);
        }
        break;
      default:
        console.warn(`Unknown RTC ready state: ${channel.readyState}`);
    }
  });
};

// (WebSocket) => (WebSocket) => Unit
const sendGreeting = (channel) => {
  switch (channel.readyState) {
    case WebSocket.CONNECTING:
      setTimeout(() => { sendFirst(channel); }, 50);
      break;
    case WebSocket.CLOSING:
    case WebSocket.CLOSED:
      console.warn(`Cannot send 'connect-established' message to WebSocket, because it is already closed`);
      break;
    case WebSocket.OPEN:
      _send(channel)("connection-established", {}, true, '00000000-0000-0000-0000-000000000000');
      break;
    default:
      console.warn(`Unknown WebSocket ready state: ${channel.readyState}`);
  }
};

// () => UUID
const genUUID = () => {

  const replacer =
    (c) => {
      r = Math.random() * 16 | 0;
      v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, replacer);

};

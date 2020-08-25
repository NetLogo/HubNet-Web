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

// (WebSocket, String, Any) => Unit
const sendObj = (...sockets) => (type, obj) => {
  sockets.forEach((socket) => {
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        setTimeout(() => { sendObj(socket)(type, obj); }, 50);
        break;
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        console.warn(`Cannot send '${type}' message to WebSocket, because it is already closed`, socket, obj);
        break;
      case WebSocket.OPEN:
        socket.send(makeMessage(type, obj));
        break;
      default:
        console.warn(`Unknown WebSocket ready state: ${socket.readyState}`);
    }
  });
};

// (RTCDataChannel*) => (String, Object[Any]) => Unit
const sendRTC = (...channels) => (type, obj) => {
  channels.forEach((channel) => {
    switch (channel.readyState) {
      case "connecting":
        setTimeout(() => { sendRTC(channel)(type, obj); }, 50);
        break;
      case "closing":
      case "closed":
        console.warn(`Cannot send '${type}' message over RTC, because the connection is already closed`, channel, obj);
        break;
      case "open":
        channel.send(makeMessage(type, obj));
        break;
      default:
        console.warn(`Unknown RTC ready state: ${channel.readyState}`);
    }
  });
};

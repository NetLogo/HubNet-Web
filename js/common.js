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
const sendObj = (socket, type, obj) => {
  if (socket.readyState === WebSocket.CONNECTING) {
    setTimeout(() => { sendObj(socket, type, obj); }, 100);
  } else {
    socket.send(makeMessage(type, obj));
  }
};

// (RTCDataChannel*) => (String, Object[Any]) => Unit
const sendRTC = (...channels) => (type, obj) => {
  channels.forEach((c) => c.send(makeMessage(type, obj)));
};

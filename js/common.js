// (String) => String
const stringToHash = function(str) {
  return Array.from(str).map((x) => x.codePointAt(0)).reduce(((acc, x) => (((acc << 5) - acc) + x) | 0), 0);
};

// (String) => Number
const uuidToRTCID = function(uuid) {
  // The docs say that the limit on the number of channels is 65534,
  // but Chromium barfs if the ID is 1024 or higher --JAB (7/15/19)
  return Math.abs(stringToHash(uuid)) % 1024;
};

const commonConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const   hostConfig = Object.assign({}, commonConfig);
const joinerConfig = Object.assign({}, commonConfig);

// (WebSocket, String, Any) => Unit
const sendObj = function(socket, type, obj) {
  if (socket.readyState === WebSocket.CONNECTING) {
    setTimeout(function() { sendObj(socket, type, obj); }, 100);
  } else {
    socket.send(JSON.stringify(Object.assign({}, { type }, obj)));
  }
};

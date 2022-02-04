import deepFreeze from "/js/static/deep-freeze.js";

// type Protocol = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket }
// type Channel  = RTCDataChannel

const commonConfig = { iceServers: [{}] };

deepFreeze(commonConfig);

export { commonConfig };

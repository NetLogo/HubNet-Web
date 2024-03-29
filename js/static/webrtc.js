import deepFreeze from "/js/static/deep-freeze.js";

// type Protocol = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket }
// type Channel  = RTCDataChannel

const commonConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

deepFreeze(commonConfig);

export { commonConfig };

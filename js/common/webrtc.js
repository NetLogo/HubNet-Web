// type Protocol = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket }
// type Channel  = RTCDataChannel

const commonConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export { commonConfig };

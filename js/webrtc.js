const commonConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const   hostConfig = { ...commonConfig };
const joinerConfig = { ...commonConfig };

// type Protocol = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket }
// type Channel  = RTCDataChannel
const HNWRTC =
  {
    status: {
      closed    : "closed"
    , closing   : "closing"
    , connecting: "connecting"
    , open      : "open"
    }
  };

export { HNWRTC, hostConfig, joinerConfig }

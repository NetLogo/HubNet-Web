import { sendObj, setSocket } from "./websocket-common.js";

onmessage = (e) => {
  switch (e.data.type) {
    case "connect": {
      const socket     = new WebSocket(e.data.url);
      socket.onopen    = () => sendObj("joiner-offer", { offer: e.data.offer });
      socket.onmessage = ({ data }) => {
        postMessage(data);
      };
      setSocket(socket);
      break;
    }
    case "ice-candidate": {
      sendObj("joiner-ice-candidate", { candidate: e.data.candidate });
      break;
    }
    default: {
      console.warn("Unknown signaling socket message type:", e.data.type, e);
    }
  }
};

import { getSocket, setSocket } from "./websocket-common.js";

onmessage = (e) => {
  switch (e.data.type) {
    case "connect":
      const socket     = new WebSocket(`ws://localhost:8080/hnw/session-stream`);
      socket.onmessage = ({ data }) => {
        postMessage(data);
      };
      setSocket(socket);
      break;
    case "hibernate":
      getSocket().close(1000, "Server list is not currently needed");
      break;
    default:
      console.warn("Unknown signaling socket message type:", e.data.type, e);
  }
};

import { hnw                  } from "./domain.js";
import { getSocket, setSocket } from "./websocket-common.js";

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {
    case "connect": {
      const socket     = new WebSocket(`ws://${hnw}/hnw/session-stream`);
      socket.onmessage = ({ data }) => {
        postMessage(data);
      };
      setSocket(socket);
      break;
    }
    case "hibernate": {
      getSocket().close(1000, "Server list is not currently needed");
      break;
    }
    default: {
      console.warn("Unknown signaling socket message type:", e.data.type, e);
    }
  }
};

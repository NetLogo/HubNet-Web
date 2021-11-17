import { hnw } from "/js/static/domain.js";

import WebSocketManager from "/js/common/websocket.js";

let socket = null; // WebSocketManager

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {
    case "connect": {
      const onMsg = ({ data }) => {
        postMessage(data);
      };
      socket = new WebSocketManager(`ws://${hnw}/hnw/session-stream`, onMsg);
      break;
    }
    case "hibernate": {
      socket.close(1000, "Session list is not currently needed");
      break;
    }
    default: {
      console.warn("Unknown signaling socket message type:", e.data.type, e);
    }
  }
};

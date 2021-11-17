import WebSocketManager from "/js/common/websocket.js";

let socket = null; // WebSocketManager

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {
    case "answer": {
      socket.send("host-answer", { answer: e.data.answer });
      break;
    }
    case "connect": {
      const onMsg = ({ data }) => {
        postMessage(data);
      };
      socket = new WebSocketManager(e.data.url, onMsg);
      break;
    }
    case "ice-candidate": {
      socket.send("host-ice-candidate", { candidate: e.data.candidate });
      break;
    }
    case "request-new-send": {
      e.ports[0].postMessage(socket.getNewSend());
      break;
    }
    case "request-bandwidth-report": {
      e.ports[0].postMessage(socket.getBandwidth());
      break;
    }
    default: {
      console.warn("Unknown signaling socket message type:", e.data.type, e);
    }
  }
};

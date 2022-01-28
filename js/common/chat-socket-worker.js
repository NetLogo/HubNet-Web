import { genUUID }      from "./util.js";
import WebSocketManager from "./websocket.js";

import { hnw, wsProto } from "/js/static/domain.js";

const uuid = genUUID(); // UUID

const onMsg = ({ data }) => {
  postMessage(data);
};

const url = `${wsProto}://${hnw}/chat`; // String

const socket = new WebSocketManager(url, onMsg); // WebSocketManager

const tick = () => {
  socket.send("tick", { sender: uuid });
};

tick();

setInterval(tick, 10000);

// (MessageEvent) => Unit
onmessage = (e) => {

  switch (e.data.type) {

    case "request-new-send": {
      e.ports[0].postMessage(socket.getNewSend());
      break;
    }

    case "request-bandwidth-report": {
      e.ports[0].postMessage(socket.getBandwidth());
      break;
    }

    case "send": {
      const message = e.data.message;
      if (message.trim().length > 0) {
        socket.send("chat", { message, sender: uuid });
      }
      break;
    }

    case "tick": {
      tick();
      break;
    }

    default: {
      console.warn("Unknown chat socket message type:", e.data.type, e);
    }

  }

};

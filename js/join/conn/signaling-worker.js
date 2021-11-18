import { hnw, wsProto } from "/js/static/domain.js";

import WebSocketManager from "/js/common/websocket.js";

let socket = null; // WebSocketManager

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {

    case "connect": {

      const { hostID, joinerID, offer } = e.data;

      const url    = `${wsProto}://${hnw}/rtc/${hostID}/${joinerID}/join`;
      const onMsg  = ({ data }) => { postMessage(data); };
      const onOpen = (self) => () => { self.send("joiner-offer", { offer }); };

      socket = new WebSocketManager(url, onMsg, onOpen);

      break;

    }

    case "ice-candidate": {
      socket.send("joiner-ice-candidate", { candidate: e.data.candidate });
      break;
    }

    default: {
      console.warn("Unknown signaling socket message type:", e.data.type, e);
    }

  }
};

import { hnw                } from "/js/common/domain.js";
import { sendObj, setSocket } from "/js/common/websocket.js";

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {

    case "connect": {

      const { hostID, joinerID, offer } = e.data;

      const socket = new WebSocket(`ws://${hnw}/rtc/${hostID}/${joinerID}/join`);

      socket.onopen = () => sendObj("joiner-offer", { offer });

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

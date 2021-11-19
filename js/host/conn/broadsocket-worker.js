import WebSocketManager from "/js/common/websocket.js";

let socket = null; // WebSocketManager

// (MessageEvent) => Unit
onmessage = (e) => {

  switch (e.data.type) {

    case "connect": {

      const onMsg = ({ data }) => {
        const datum = JSON.parse(data);
        switch (datum.type) {
          case "hello": {
            e.ports[0].postMessage(datum.joinerID);
            break;
          }
          default:
            console.warn("Unknown broad event type:", datum.type);
        }
      };

      socket = new WebSocketManager(e.data.url, onMsg);

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
      console.warn("Unknown broadSocket message type:", e.data.type, e);
    }

  }

};

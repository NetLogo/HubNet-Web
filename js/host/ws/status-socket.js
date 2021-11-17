import Base64Encoder from "./base64-encoder.js";

import WebSocketManager from "/js/common/websocket.js";

let lastMemberCount = null; // Number
let socket          = null; // WebSocketManager

const encoder = new Base64Encoder();

// (MessageEvent) => Unit
onmessage = (e) => {

  switch (e.data.type) {

    case "connect": {
      socket = new WebSocketManager(e.data.url);
      break;
    }

    case "image-update": {
      encoder.encode(e.data.blob).then(
        (base64) => {
          socket.send("image-update", { base64 });
        }
      );
      break;
    }

    case "members-update": {
      if (lastMemberCount !== e.data.numPeers) {
        lastMemberCount = e.data.numPeers;
        socket.send("members-update", { numPeers: e.data.numPeers });
      }
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
      console.warn("Unknown status socket message type:", e.data.type, e);
    }

  }

};

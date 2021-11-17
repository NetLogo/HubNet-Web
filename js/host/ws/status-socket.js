import { reportBandwidth, reportNewSend } from "/js/common/bandwidth-monitor.js";
import { sendObj, setSocket             } from "/js/common/websocket.js";

import Base64Encoder from "./base64-encoder.js";

let lastMemberCount = null; // Number

const encoder = new Base64Encoder();

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {
    case "connect": {
      setSocket(new WebSocket(e.data.url));
      break;
    }
    case "image-update": {
      encoder.encode(e.data.blob).then(
        (base64) => {
          sendObj("image-update", { base64 });
        }
      );
      break;
    }
    case "members-update": {
      if (lastMemberCount !== e.data.numPeers) {
        lastMemberCount = e.data.numPeers;
        sendObj("members-update", { numPeers: e.data.numPeers });
      }
      break;
    }
    case "request-new-send": {
      e.ports[0].postMessage(reportNewSend());
      break;
    }
    case "request-bandwidth-report": {
      e.ports[0].postMessage(reportBandwidth());
      break;
    }
    default: {
      console.warn("Unknown status socket message type:", e.data.type, e);
    }
  }
};

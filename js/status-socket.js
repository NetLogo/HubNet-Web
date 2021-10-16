import { reportBandwidth    } from "./bandwidth-monitor.js"
import { sendObj, setSocket } from "./websocket-common.js"

let lastImageUpdate = undefined; // Base64String
let lastMemberCount = undefined; // Number

onmessage = (e) => {
  switch (e.data.type) {
    case "connect":
      setSocket(new WebSocket(e.data.url));
      break;
    case "image-update":
      if (lastImageUpdate !== e.data.base64) {
        lastImageUpdate = e.data.base64;
        sendObj("image-update", { base64: e.data.base64 });
      }
      break;
    case "members-update":
      if (lastMemberCount !== e.data.numPeers) {
        lastMemberCount = e.data.numPeers;
        sendObj("members-update", { numPeers: e.data.numPeers });
      }
      break;
    case "request-bandwidth-report":
      e.ports[0].postMessage(reportBandwidth());
      break;
    default:
      console.warn("Unknown status socket message type:", e.data.type, e)
  }
};

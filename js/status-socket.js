import { reportBandwidth, reportNewSend } from "./bandwidth-monitor.js";
import { sendObj, setSocket } from "./websocket-common.js";

let lastMemberCount = undefined; // Number

const base64EncoderW = new Worker("b64-encoder.js", { type: "module" });

base64EncoderW.onmessage = ({ data }) => {
  sendObj("image-update", { base64: data });
};

onmessage = (e) => {
  switch (e.data.type) {
    case "connect":
      setSocket(new WebSocket(e.data.url));
      break;
    case "image-update":
      base64EncoderW.postMessage({ type: "encode-blob", blob: e.data.blob });
      break;
    case "members-update":
      if (lastMemberCount !== e.data.numPeers) {
        lastMemberCount = e.data.numPeers;
        sendObj("members-update", { numPeers: e.data.numPeers });
      }
      break;
    case "request-new-send":
      e.ports[0].postMessage(reportNewSend());
      break;
    case "request-bandwidth-report":
      e.ports[0].postMessage(reportBandwidth());
      break;
    default:
      console.warn("Unknown status socket message type:", e.data.type, e);
  }
};

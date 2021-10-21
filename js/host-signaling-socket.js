import { reportBandwidth, reportNewSend } from "./bandwidth-monitor.js"
import { sendObj, setSocket } from "./websocket-common.js"

onmessage = (e) => {
  switch (e.data.type) {
    case "answer":
      sendObj("host-answer", { answer: e.data.answer });
      break;
    case "connect":
      const socket = new WebSocket(e.data.url);
      socket.onmessage = ({ data }) => {
        postMessage(data);
      };
      setSocket(socket);
      break;
    case "ice-candidate":
      sendObj("host-ice-candidate", { candidate: e.data.candidate });
      break;
    case "request-new-send":
      e.ports[0].postMessage(reportNewSend());
      break;
    case "request-bandwidth-report":
      e.ports[0].postMessage(reportBandwidth());
      break;
    default:
      console.warn("Unknown signaling socket message type:", e.data.type, e)
  }
};

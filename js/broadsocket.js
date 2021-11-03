import { reportBandwidth, reportNewSend } from "./bandwidth-monitor.js";
import { setSocket } from "./websocket-common.js";

onmessage = (e) => {
  switch (e.data.type) {
    case "connect":
      const socket = new WebSocket(e.data.url);
      socket.onmessage = ({ data }) => {
        const datum = JSON.parse(data);
        switch (datum.type) {
          case "hello":
            postMessage(datum);
            break;
          default:
            console.warn(`Unknown broad event type: ${datum.type}`);
        }
      };
      setSocket(socket);
      break;
    case "request-new-send":
      e.ports[0].postMessage(reportNewSend());
      break;
    case "request-bandwidth-report":
      e.ports[0].postMessage(reportBandwidth());
      break;
    default:
      console.warn("Unknown broadSocket message type:", e.data.type, e);
  }
};

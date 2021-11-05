import { decodePBuf } from "./converters-common.js";

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {
    case "decode": {
      const decoded = decodePBuf(true)(e.data.parcel);
      e.ports[0].postMessage(decoded);
      break;
    }
    default: {
      console.warn("Unknown decode message type:", e.data.type, e);
    }
  }
};

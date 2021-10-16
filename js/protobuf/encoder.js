import { encodePBuf } from "./converters-common.js"

onmessage = (e) => {
  switch (e.data.type) {
    case "encode":
      let encoded = encodePBuf(true)(e.data.parcel);
      e.ports[0].postMessage(encoded);
      break;
    default:
      console.warn("Unknown encoder message type:", e.data.type, e)
  }
};

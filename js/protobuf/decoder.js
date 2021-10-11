importScripts("../../assets/js/protobuf.min.js");
importScripts("init-transformers.js");
importScripts("joiner-relay-payload.js");
importScripts("role.js");
importScripts("state-update.js");
importScripts("from-host-root.js");
importScripts("from-joiner-root.js");
importScripts("converters-common.js");
importScripts("host-converters.js");

onmessage = (e) => {
  switch (e.data.type) {
    case "decode":
      let decoded = self.decodeInput(e.data.parcel);
      e.ports[0].postMessage(decoded);
      break;
    default:
      console.warn("Unknown decode message type:", e.data.type, e)
  }
};

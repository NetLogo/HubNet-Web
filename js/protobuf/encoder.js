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
    case "encode":
      let encoded = self.encodeOutput(e.data.parcel);
      e.ports[0].postMessage(encoded);
      break;
    default:
      console.warn("Unknown encoder message type:", e.data.type, e)
  }
};

// (String, String, (Boolean) => (Object[Any]) => Object[Any]) => (MessageEvent) => Unit
const handleMessage = (name, msgType, xf) => (e) => {
  switch (e.data.type) {
    case msgType: {
      const xserialized = xf(e.data.isHost)(e.data.parcel);
      e.ports[0].postMessage(xserialized);
      break;
    }
    default: {
      console.warn(`Unknown ${name} message type:`, e.data.type, e);
    }
  }
};

export { handleMessage };

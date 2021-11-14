// (String, String, (Boolean) => (Object[Any]) => Object[Any]) => (MessageEvent) => Unit
const handleMessage = (name, msgType, f) => (e) => {
  switch (e.data.type) {
    case msgType: {
      const serialized = f(e.data.isHost)(e.data.parcel);
      e.ports[0].postMessage(serialized);
      break;
    }
    default: {
      console.warn(`Unknown ${name} message type:`, e.data.type, e);
    }
  }
};

export { handleMessage };

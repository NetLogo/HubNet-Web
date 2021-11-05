// (String, String, (Boolean) => (Object[Any]) => Object[Any]) => (MessageEvent) => Unit
const handleMessage = (name, msgType, f) => (e) => {
  switch (e.data.type) {
    case msgType: {
      const coded = f(true)(e.data.parcel);
      e.ports[0].postMessage(coded);
      break;
    }
    default: {
      console.warn(`Unknown ${name} message type:`, e.data.type, e);
    }
  }
};

export { handleMessage };

import { awaitWorker } from "/js/common/await.js";

// (String) => (Object[Any]) => Unit
const handleMessage = (descriptor) => (msg) => {
  switch (msg.type) {
    case "shutdown-complete": {
      break;
    }
    default: {
      console.warn(`Unknown ${descriptor} pool response type:`, msg.type, msg);
    }
  }
};

const serializerURL      = "js/serialize/serializer-pool.js";
const serializerPool     = new Worker(serializerURL, { type: "module" });
serializerPool.onmessage = handleMessage("serializer");

const deserializerURL      = "js/serialize/deserializer-pool.js";
const deserializerPool     = new Worker(deserializerURL, { type: "module" });
deserializerPool.onmessage = handleMessage("deserializer");

// (String, Object[Any]) => Promise[Any]
const awaitDeserializer = awaitWorker(deserializerPool);
const awaitSerializer   = awaitWorker(  serializerPool);

// (Worker) => (Object[Any]) => Unit
const notify = (pool) => (type, msg = {}) => {
  pool.postMessage({ ...msg, type });
};

const notifyDeserializer = notify(deserializerPool); // (Object[Any]) => Unit
const notifySerializer   = notify(  serializerPool); // (Object[Any]) => Unit

export { awaitDeserializer, awaitSerializer, notifyDeserializer, notifySerializer };

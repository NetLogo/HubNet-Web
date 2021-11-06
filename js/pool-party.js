import { awaitWorker } from "./await.js";

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

const encoderPool = new Worker("js/protobuf/encoder-pool.js", { type: "module" });
encoderPool.onmessage = handleMessage("encoder");

const decoderPool = new Worker("js/protobuf/decoder-pool.js", { type: "module" });
decoderPool.onmessage = handleMessage("decoder");

// (String, Object[Any]) => Promise[Any]
const awaitDecoder = awaitWorker(decoderPool);
const awaitEncoder = awaitWorker(encoderPool);

// (Worker) => (Object[Any]) => Unit
const notify = (pool) => (type, msg = {}) => {
  pool.postMessage({ ...msg, type });
};

const notifyDecoder = notify(decoderPool); // (Object[Any]) => Unit
const notifyEncoder = notify(encoderPool); // (Object[Any]) => Unit

export { awaitDecoder, awaitEncoder, notifyDecoder, notifyEncoder };

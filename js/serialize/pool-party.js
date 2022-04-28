import { awaitWorker } from "/js/common/await.js";
import genWorkerLike   from "/js/common/worker-like.js";

export default class PoolParty {

  // abstract type InType
  // abstract type OutType

  #mainMsg = undefined; // String
  #pool    = undefined; // WorkerLike[XSerializerPool]

  // (String, String, String) => PoolParty
  constructor(workerURL, mainMsg, desc) {
    this.#mainMsg        = mainMsg;
    this.#pool           = genWorkerLike(workerURL, { type: "module" });
    this.#pool.onmessage = handleMessage(desc);
  }

  // (Boolean, InType) => Promise[OutType]
  "await" = (isHost, parcel) => {
    return awaitWorker(this.#pool)(this.#mainMsg, { isHost, parcel });
  };

  // () => Unit
  notifyClientConnect = () => {
    this.#pool.postMessage({ type: "client-connect" });
  };

  // () => Unit
  notifyClientDisconnect = () => {
    this.#pool.postMessage({ type: "client-disconnect" });
  };

  // () => Unit
  shutdown = () => {
    this.#pool.postMessage({ type: "shutdown" });
  };

}

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

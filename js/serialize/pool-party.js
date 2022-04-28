import { awaitWorker } from "/js/common/await.js";

export default class PoolParty {

  // abstract type InType
  // abstract type OutType

  #mainMsg = undefined; // String
  #pool    = undefined; // Worker[XSerializerPool]

  // (String, String, String) => PoolParty
  constructor(workerURL, mainMsg, desc) {
    this.#mainMsg        = mainMsg;
    this.#pool           = new Worker(workerURL, { type: "module" });
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

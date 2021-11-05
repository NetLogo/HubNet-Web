import { awaitWorker } from "../await.js";

// Number
const maxNumWorkers = Math.max(1, navigator.hardwareConcurrency);

// Array[{ isIdle: Boolean, worker: WebWorker }]
const workerPool = [];

// (String) => Unit
const initWorker = (workerPath) => {
  const worker = new Worker(`${workerPath}`, { type: "module" });
  workerPool.push({ worker, isIdle: true });
};

// (Object[Any], MessagePort, String) => Unit
const code = (msg, port, type) => {

  const workerBundle = workerPool.find((bundle) => bundle.isIdle);

  if (workerBundle !== undefined) {

    workerBundle.isIdle = false;

    const message = { type, parcel: msg };

    awaitWorker(workerBundle.worker, message).then(
      (coded) => {
        workerBundle.isIdle = true;
        port.postMessage(coded);
      }
    );

  } else {
    setTimeout((() => code(msg, port, type)), 5);
  }

};

// (String, String, String, String) => (MessageEvent) => Unit
const handleMessage = (reqMsgType, innerMsgType, workerPath, poolDesc) => {
  initWorker(workerPath);
  return (e) => {
    switch (e.data.type) {
      case "client-connect": {
        if (workerPool.length < maxNumWorkers) {
          initWorker(workerPath);
        }
        break;
      }
      case "client-disconnect": {
        break;
      }
      case reqMsgType: {
        code(e.data.parcel, e.ports[0], innerMsgType);
        break;
      }
      case "shutdown": {
        workerPool.forEach((w) => w.worker.terminate());
        postMessage({ type: "shutdown-complete" });
        break;
      }
      default: {
        console.warn(`Unknown ${poolDesc} pool message type:`, e.data.type, e);
      }
    }
  };
};

export { handleMessage };

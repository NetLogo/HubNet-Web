import { awaitWorker } from "/js/common/await.js";

// Number
const maxNumWorkers = Math.max(1, navigator.hardwareConcurrency);

// Array[{ isIdle: Boolean, worker: WebWorker }]
const workerPool = [];

// (String) => Unit
const initWorker = (workerPath) => {
  const worker = new Worker(`${workerPath}`, { type: "module" });
  workerPool.push({ worker, isIdle: true });
};

// (Object[Any], Boolean, MessagePort, String) => Unit
const code = (parcel, isHost, port, type) => {

  const workerBundle = workerPool.find((bundle) => bundle.isIdle);

  if (workerBundle !== undefined) {

    workerBundle.isIdle = false;

    const message = { parcel, isHost };

    awaitWorker(workerBundle.worker)(type, message).then(
      (coded) => {
        workerBundle.isIdle = true;
        port.postMessage(coded);
      }
    );

  } else {
    setTimeout((() => code(parcel, isHost, port, type)), 5);
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
        code(e.data.parcel, e.data.isHost, e.ports[0], innerMsgType);
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

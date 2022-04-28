import { awaitWorker } from "/js/common/await.js";

// Number
const maxNumWorkers = Math.max(1, navigator.hardwareConcurrency);

// Array[{ isIdle: Boolean, worker: WebWorker }]
const workerPool = [];

// (String, String) => Unit
const initWorker = (workerPath, msgType) => {
  const worker = new Worker(workerPath, { type: "module" });
  worker.messageType = msgType;
  workerPool.push({ worker, isIdle: true });
};

// (Object[Any], Boolean, MessagePort, String) => Unit
const xserialize = (parcel, isHost, port, type) => {

  const workerBundle =
    workerPool.find(
      (bundle) => bundle.isIdle && bundle.worker.messageType === type
    );

  if (workerBundle !== undefined) {

    workerBundle.isIdle = false;

    const message = { parcel, isHost };

    awaitWorker(workerBundle.worker)(type, message).then(
      (xserialized) => {
        workerBundle.isIdle = true;
        port.postMessage(xserialized);
      }
    );

  } else {
    setTimeout((() => xserialize(parcel, isHost, port, type)), 1);
  }

};

// (String, String, String, String) => (MessageEvent) => Unit
const handleMessage = (reqMsgType, innerMsgType, workerPath, poolDesc) => {
  initWorker(workerPath, innerMsgType);
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
        xserialize(e.data.parcel, e.data.isHost, e.ports[0], innerMsgType);
        break;
      }
      case "shutdown": {
        workerPool.forEach((w) => w.worker.terminate());
        self.notifyParent({ type: "shutdown-complete" });
        break;
      }
      default: {
        console.warn(`Unknown ${poolDesc} pool message type:`, e.data.type, e);
      }
    }
  };
};

// () => Unit
const terminate = () => {
  workerPool.forEach((worker) => worker.terminate());
  while (workerPool.length > 0) {
    workerPool.pop();
  }
};

export { handleMessage, terminate };

import { awaitWorker } from "/js/common/await.js";
import genWorker       from "/js/common/worker.js";

// Number
const maxNumWorkers = Math.max(1, navigator.hardwareConcurrency);

// type Job = { parcel: Object[Any], isHost: Boolean
//            , post: MessagePort, type: String) }

// type WorkerBundle = { isIdle: Boolean, worker: WebWorker }

// Array[WorkerBundle]
const workerPool = [];

// Array[Job]
const jobQueue = [];

// (String, String) => Unit
const initWorker = (workerPath, msgType) => {
  const worker = genWorker(workerPath);
  worker.messageType = msgType;
  workerPool.push({ worker, isIdle: true });
};

// (Object[Any], Boolean, MessagePort, String) => Unit
const xserialize = (parcel, isHost, port, type) => {

  const workerBundle =
    workerPool.find(
      (bundle) => bundle.isIdle && bundle.worker.messageType === type
    );

  const job = { parcel, isHost, port, type };

  if (workerBundle !== undefined) {
    runWorker(job, workerBundle);
  } else {
    jobQueue.push(job);
  }

};

// ({ Object[Any], Boolean, MessagePort, String }, WorkerBundle) => Unit
const runWorker = ({ parcel, isHost, port, type }, workerBundle) => {

  workerBundle.isIdle = false;

  const message = { parcel, isHost };

  awaitWorker(workerBundle.worker)(type, message).then(
    (xserialized) => {

      port.postMessage(xserialized);

      if (jobQueue.length > 0) {
        runWorker(jobQueue.shift(), workerBundle);
      } else {
        workerBundle.isIdle = true;
      }
    }
  );

};

// (String, String, String, String) => (MessageEvent) => Unit
const handleMessage = (reqMsgType, innerMsgType, workerPath, poolDesc) => {
  initWorker(workerPath, innerMsgType);
  return (e) => {
    switch (e.data.type) {
      case "client-connect": {
        if (workerPool.length < maxNumWorkers) {
          initWorker(workerPath, innerMsgType);
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

import { awaitWorker } from "../await.js";

const maxNumWorkers = Math.max(1, navigator.hardwareConcurrency);

// Array[{ isIdle: Boolean, worker: WebWorker }]
const workerPool = [];

const initWorker = () => {
  const worker = new Worker("encoder.js", { type: "module" });
  workerPool.push({ worker, isIdle: true });
};

const encode = (msg, port) => {

  const workerBundle = workerPool.find((bundle) => bundle.isIdle);

  if (workerBundle !== undefined) {

    workerBundle.isIdle = false;

    const message = { type: "encode", parcel: msg };

    awaitWorker(workerBundle.worker, message).then(
      (decoded) => {
        workerBundle.isIdle = true;
        port.postMessage(decoded);
      }
    );

  } else {
    setTimeout((() => encode(msg, port)), 50);
  }

};

// (MessageEvent) => Unit
onmessage = (e) => {
  switch (e.data.type) {
    case "client-connect": {
      if (workerPool.length < maxNumWorkers) {
        initWorker();
      }
      break;
    }
    case "client-disconnect": {
      break;
    }
    case "encode": {
      encode(e.data.parcel, e.ports[0]);
      break;
    }
    case "shutdown": {
      workerPool.forEach((w) => w.worker.terminate());
      postMessage({ type: "shutdown-complete" });
      break;
    }
    default: {
      console.warn("Unknown encoder pool message type:", e.data.type, e);
    }
  }
};

initWorker();

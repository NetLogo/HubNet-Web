import { awaitWorker } from "../await.js";

const maxNumWorkers = Math.max(1, navigator.hardwareConcurrency);

// Array[{ isIdle: Boolean, worker: WebWorker }]
const workerPool = [];

const initWorker = () => {
  const worker = new Worker("decoder.js", { type: "module" });
  workerPool.push({ worker, isIdle: true });
};

const decode = (msg, port) => {

  const workerBundle = workerPool.find((bundle) => bundle.isIdle);

  if (workerBundle !== undefined) {

    workerBundle.isIdle = false;

    const message = { type: "decode", parcel: msg };

    awaitWorker(workerBundle.worker, message).then(
      (decoded) => {
        workerBundle.isIdle = true;
        port.postMessage(decoded);
      }
    );

  } else {
    setTimeout((() => decode(msg, port)), 50);
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
    case "decode": {
      decode(e.data.parcel, e.ports[0]);
      break;
    }
    case "shutdown": {
      workerPool.forEach((w) => w.worker.terminate());
      postMessage({ type: "shutdown-complete" });
      break;
    }
    default: {
      console.warn("Unknown decoder pool message type:", e.data.type, e);
    }
  }
};

initWorker();

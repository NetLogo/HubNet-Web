let clientCount = 0;

let maxNumWorkers = Math.max(1, navigator.hardwareConcurrency - 4);

// Array[{ isIdle: Boolean, worker: WebWorker }]
let workerPool = [];

initWorker = () => {
  let worker = new Worker('decoder.js');
  workerPool.push({ worker, isIdle: true });
};

decode = (msg, port) => {
  let workerBundle = workerPool.find((bundle) => bundle.isIdle);
  if (workerBundle !== undefined) {
    workerBundle.isIdle = false;

    new Promise(
      (resolve, reject) => {

        const channel = new MessageChannel();

        channel.port1.onmessage = ({ data }) => {
          channel.port1.close();
          resolve(data);
        };

        workerBundle.worker.postMessage({ type: "decode", parcel: msg }, [channel.port2]);

      }
    ).then((decoded) => {
      workerBundle.isIdle = true;
      port.postMessage(decoded);
    });

  } else {
    console.log("All workers are currently busy.  Retrying momentarily....", msg);
    setTimeout((() => decode(msg, port)), 50);
  }
};

onmessage = (e) => {
  switch (e.data.type) {
    case "client-connect":
      clientCount++;
      if ((workerPool.length < maxNumWorkers) && (clientCount % 4 === 1)) {
        initWorker();
      }
      break;
    case "client-disconnect":
      clientCount--;
      break;
    case "decode":
      decode(e.data.parcel, e.ports[0]);
      break;
    case "shutdown":
      workerPool.forEach((w) => w.worker.terminate());
      postMessage({ type: "shutdown-complete" });
      break;
    default:
      console.warn("Unknown decoder pool message type:", e.data.type, e)
  }
};

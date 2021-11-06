import { galapagos } from "./domain.js";

// [T] @ ((T, Object[Any], MessagePort) => Unit) => (T) => (String, Object[Any]) => Promise[Any]
const awaitResponse = (postMessage) => (target) => (type, msg = {}) => {

  const f =
    (resolve) => {

      const channel = new MessageChannel();

      channel.port1.onmessage = ({ data }) => {
        channel.port1.close();
        resolve(data);
      };

      postMessage(target, { ...msg, type }, channel.port2);

    };

  return new Promise(f);

};

// (ContentWindow) => (String, Object[Any]) => Promise[Any]
const awaitFrame =
  awaitResponse(
    (frame, msg, port) => {
      frame.postMessage(msg, `http://${galapagos}`, [port]);
    }
  );

// (WebWorker) => (String, Object[Any]) => Promise[Any]
const awaitWorker =
  awaitResponse(
    (worker, msg, port) => {
      worker.postMessage(msg, [port]);
    }
  );

export { awaitFrame, awaitWorker };

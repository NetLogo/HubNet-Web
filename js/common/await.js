// [T] @ ((T, Object[Any], MessagePort) => Unit) => (T) => (String, Object[Any]?) => Promise[Any]
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

// (String?) => (Window) => (String, Object[Any]?) => Promise[Any]
const awaitFrame = (domain = "*") =>
  awaitResponse(
    (frame, msg, port) => {
      frame.postMessage(msg, domain, [port]);
    }
  );

// (MessagePort) => (String, Object[Any]?) => Promise[Any]
const awaitPort =
  awaitResponse(
    (sendPort, msg, receivePort) => {
      sendPort.postMessage(msg, [receivePort]);
    }
  );

// (WebWorker) => (String, Object[Any]?) => Promise[Any]
const awaitWorker =
  awaitResponse(
    (worker, msg, port) => {
      worker.postMessage(msg, [port]);
    }
  );

// (() => Boolean, () => T) => (() => Unit) => Promise[T]
const retryUntil = (cond, getValue) => (f) => {

  const wrapper =
    (resolve) => {
      const innerF =
        () => {
          if (cond()) {
            resolve(getValue());
          } else {
            f();
            setTimeout(innerF, 1000 / 60);
          }
        };
      innerF();
    };

  return new Promise(wrapper);

};

// (String?) => (Window) => (String, Object[Any]?) => Promise[MessagePort]
const spamFrameForPort = (domain = "*") => (frame) => (type, msg = {}) => {

  let resolution = null;

  const postMsg =
    () => {

      const channel = new MessageChannel();

      channel.port1.onmessage = () => {
        channel.port1.onmessage = undefined;
        resolution = channel.port1;
      };

      frame.postMessage({ ...msg, type }, domain, [channel.port2]);

    };

  return retryUntil((() => resolution !== null), () => resolution)(postMsg);

};

export { awaitFrame, awaitPort, awaitWorker, spamFrameForPort };

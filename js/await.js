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

// (WebWorker) => (String, Object[Any]?) => Promise[Any]
const awaitWorker =
  awaitResponse(
    (worker, msg, port) => {
      worker.postMessage(msg, [port]);
    }
  );

// (String?) => (Window) => (String, Object[Any]?) => Promise[Any]
const spamFrame = (domain = "*") => (frame) => (type, msg = {}) => {

  let resolution = null;

  const postMsg =
    () => {

      const channel = new MessageChannel();

      channel.port1.onmessage = ({ data }) => {
        channel.port1.close();
        resolution = data;
      };

      frame.postMessage({ ...msg, type }, domain, [channel.port2]);

    };

  const wrapper =
    (resolve) => {
      const innerF =
        () => {
          if (resolution !== null) {
            resolve(resolution);
          } else {
            postMsg();
            setTimeout(innerF, 1000 / 60);
          }
        };
      innerF();
    };

  return new Promise(wrapper);

};

export { awaitFrame, awaitWorker, spamFrame };

import genWorker from "/js/common/worker.js";

export default class SessionStream {

  #worker = undefined; // Worker[SessionStreamWorker]

  // ((Object[Any]) => Unit) => SessionStream
  constructor(onmessage) {
    this.#worker = genWorker("js/join/ui/session/session-stream-worker.js");
    this.connect();
    this.#worker.onmessage = onmessage;
  }

  // () => Unit
  connect = () => {
    this.#send("connect");
  };

  // () => Unit
  hibernate = () => {
    this.#send("hibernate");
  };

  // (String, Object[Any]?) => Unit
  #send = (type, msg = {}) => {
    this.#worker.postMessage({ type, ...msg });
  };

}

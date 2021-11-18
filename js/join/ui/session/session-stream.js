export default class SessionStream {

  #worker = undefined; // Worker[SessionStreamWorker]

  // ((Object[Any]) => Unit) => SessionStream
  constructor(onmessage) {
    const buddyURL = "js/join/ui/session/session-stream-worker.js";
    this.#worker   = new Worker(buddyURL, { type: "module" });
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

  #send = (type, msg = {}) => {
    this.#worker.postMessage({ type, ...msg });
  };

}

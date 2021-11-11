export default class ServerList {

  #worker = undefined; // Worker[ServerListSocket]

  // ((Object[Any]) => Unit) => ServerList
  constructor(onmessage) {
    const buddyURL = "js/server-list-socket.js";
    this.#worker = new Worker(buddyURL, { type: "module" });
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

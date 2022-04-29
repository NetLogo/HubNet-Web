import { awaitWorker } from "/js/common/await.js";
import genWorker       from "/js/common/worker.js";

import { hnw, wsProto } from "/js/static/domain.js";

export default class StatusSocket {

  #worker = undefined; // Worker[StatusSocketWorker]

  // () => StatusSocket
  constructor() {
    this.#worker = genWorker("js/host/conn/status-socket-worker.js");
  }

  // (String) => Promise[_]
  "await" = (msg) => {
    return awaitWorker(this.#worker)(msg);
  };

  // (UUID) => Unit
  connect = (hostID) => {
    const url = `${wsProto}://${hnw}/hnw/my-status/${hostID}`;
    this.#worker.postMessage({ type: "connect", url });
  };

  // (Blob) => Unit
  postImageUpdate = (blob) => {
    this.#worker.postMessage({ type: "image-update", blob });
  };

  // (Number) => Unit
  updateNumPeers = (numPeers) => {
    this.#worker.postMessage({ type: "members-update", numPeers });
  };

}

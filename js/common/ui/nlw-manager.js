import { awaitPort } from "/js/common/await.js";

import { galapagos, galaProto } from "/js/static/domain.js";

export default class NLWManager {

  #babyMonitor   = null;      // MessagePort
  #outerFrame    = undefined; // Element
  #resolverQueue = undefined; // Array[() => Unit]

  // (Element) => NLWManager
  constructor(outerFrame) {
    this.#outerFrame    = outerFrame;
    this.#resolverQueue = [];
  }

  // (String, Object[Any]?) => Promise[Any]
  "await" = (type, msg = {}) => {
    return this.#withBabyMonitor((bm) => awaitPort(bm)(type, msg));
  };

  // () => Unit
  hide = () => {
    this.#babyMonitor?.close();
    this.#babyMonitor = null;
    this.#outerFrame.classList.add("hidden");
    this.#resolverQueue = [];
    this._hide();
  };

  // () => Unit
  init = () => {};

  // (Object[Any]) => Unit
  post = (msg) => {
    this.#withBabyMonitor((bm) =>
      new Promise((resolve) => {
        bm.postMessage(msg);
        resolve();
      })
    );
  };

  // () => Unit
  show = () => {
    this.#outerFrame.classList.remove("hidden");
    this._show();
  };

  // ((MessagePort) => Promise[T]) => Promise[T]
  #withBabyMonitor = (f) => {
    if (this.#babyMonitor !== null) {
      return f(this.#babyMonitor);
    } else {
      return new Promise((resolve) => {
        this.#resolverQueue.push(resolve);
      }).then(
        () => f(this.#babyMonitor)
      );
    }
  };

  // () => String
  _galaURL = `${galaProto}://${galapagos}`;

  // () => HTMLIFrameElement
  _getFrame = () => {
    return this.#outerFrame.querySelector("iframe");
  };

  // () => Unit
  _hide = () => {};

  // (Object[Any]) => Unit
  _onBabyMonitorMessage = () => {};

  // (MessagePort) => Unit
  _setBabyMonitor = (bm) => {

    this.#babyMonitor = bm;
    this.#resolverQueue.forEach((f) => f());
    this.#resolverQueue = [];

    bm.onmessage = this._onBabyMonitorMessage;

  };

  // () => Unit
  _show = () => {};

}

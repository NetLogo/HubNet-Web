import { awaitPort, spamFrameForPort } from "./await.js";
import { galapagos, galaProto        } from "./domain.js";

import fakeModel from "./fake-model.js";

const galaURL = `${galaProto}://${galapagos}`;

export default class NLWManager {

  #babyMonitor   = null;      // MessagePort
  #onError       = undefined; // (String) => Unit
  #outerFrame    = undefined; // Element
  #resolverQueue = undefined; // Array[() => Unit]
  #send          = undefined; // (String, Object[Any]) => Unit

  // (Element, (String, Object[Any]) => Unit, () => Unit, (String) => Unit) => NLWManager
  constructor(outerFrame, send, onDisconnect, onError) {

    this.#outerFrame    = outerFrame;
    this.#onError       = onError;
    this.#resolverQueue = [];
    this.#send          = send;

    outerFrame.querySelector("#disconnect-button").
      addEventListener("click", onDisconnect);

  }

  // (String, Object[Any]?) => Promise[Any]
  "await" = (type, msg = {}) => {
    return this.#withBabyMonitor((bm) => awaitPort(bm)(type, msg));
  };

  hide = () => {
    this.#babyMonitor.close();
    this.#babyMonitor = null;
    this.#outerFrame.classList.add("hidden");
    this.#resolverQueue = [];
    this.post(fakeModel);
  };

  // () => Unit
  init = () => {
    this.#outerFrame.querySelector("iframe").src = `${galaURL}/hnw-join`;
  };

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

    const iframe     = this.#outerFrame.querySelector("iframe");
    const galaWindow = iframe.contentWindow;

    spamFrameForPort(galaURL)(galaWindow)("hnw-set-up-baby-monitor").
      then(
        (babyMonitor) => {

          this.#setBabyMonitor(babyMonitor);

          babyMonitor.onmessage = ({ data }) => {
            switch (data.type) {
              case "relay": {
                this.#send("relay", data);
                break;
              }
              case "hnw-fatal-error": {
                this.#onError(data.subtype);
                break;
              }
              default: {
                console.warn(`Unknown baby monitor type: ${data.type}`);
              }
            }
          };

        }
      );

  };

  // (MessagePort) => Unit
  #setBabyMonitor = (bm) => {
    this.#babyMonitor = bm;
    this.#resolverQueue.forEach((f) => f());
    this.#resolverQueue = [];
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

}

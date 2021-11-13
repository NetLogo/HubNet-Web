import { awaitFrame, spamFrame } from "./await.js";
import { galapagos, galaProto  } from "./domain.js";

import fakeModel from "./fake-model.js";

const galaURL = `${galaProto}://${galapagos}`;

export default class NLWManager {

  #outerFrame = undefined; // Element
  #galaWindow = undefined; // Window

  // (Element, () => Unit) => NLWManager
  constructor(outerFrame, onDisconnect) {

    this.#outerFrame = outerFrame;
    this.#galaWindow = outerFrame.querySelector("iframe").contentWindow;

    outerFrame.querySelector("#disconnect-button").
      addEventListener("click", onDisconnect);

  }

  // (String, Object[Any]?) => Promise[Any]
  "await" = (type, msg = {}) => {
    return awaitFrame(galaURL)(this.#galaWindow)(type, msg);
  };

  hide = () => {
    this.#outerFrame.classList.add("hidden");
    this.post(fakeModel);
  };

  // () => Unit
  init = () => {
    this.#outerFrame.querySelector("iframe").src = `${galaURL}/hnw-join`;
  };

  // (String, Object[Any]) => Unit
  post = (msg) => {
    this.#galaWindow.postMessage(msg, galaURL);
  };

  // () => Unit
  show = () => {
    this.#outerFrame.classList.remove("hidden");
  };

  // (String, Object[Any]?) => Promise[Any]
  spam = (type, msg = {}) => {
    return spamFrame(galaURL)(this.#galaWindow)(type, msg);
  };

}

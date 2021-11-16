import { spamFrameForPort } from "/js/common/await.js";

import NLWManager from "/js/common/ui/nlw-manager.js";

import fakeModel from "./fake-model.js";

export default class JoinerNLWManager extends NLWManager {

  #onError = undefined; // (String) => Unit
  #send    = undefined; // (String, Object[Any]) => Unit

  // (Element, (String, Object[Any]) => Unit, () => Unit, (String) => Unit) => JoinerNLWManager
  constructor(outerFrame, send, onDisconnect, onError) {

    super(outerFrame);

    this.#onError = onError;
    this.#send    = send;

    outerFrame.querySelector("#disconnect-button").
      addEventListener("click", onDisconnect);

  }

  // () => Unit
  init = () => {
    this._getFrame().src = `${this._galaURL}/hnw-join`;
  };

  // (Object[Any]) => Unit
  _onBabyMonitorMessage = ({ data }) => {
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
        console.warn("Unknown baby monitor message type:", data);
      }
    }
  };

  // () => Unit
  _hide = () => {
    this.post(fakeModel);
  };

  // () => Unit
  _show = () => {
    const galaWindow = this._getFrame().contentWindow;
    spamFrameForPort(this._galaURL)(galaWindow)("hnw-set-up-baby-monitor").
      then(this._setBabyMonitor);
  };

}

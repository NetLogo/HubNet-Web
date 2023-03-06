import { spamFrameForPort } from "/js/common/await.js";

import NLWManager from "/js/common/ui/nlw-manager.js";

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

  // (String) => Unit
  appendOutput = (output) => {
    this._post({ type: "nlw-append-output", output });
  };

  // (Object[Any]) => Promise[Any]
  awaitLoadInterface = (interfaceObj) => {
    return this._await("hnw-load-interface", interfaceObj);
  };

  // () => Unit
  init = () => {
    this._getFrame().src = `${this._galaURL}/hnw/join`;
  };

  // (Object[Any]) => Unit
  postUpdate = (update) => {
    this._post({ type: "nlw-apply-update", update });
  };

  // (Object[Any]) => Unit
  registerAssignedAgent = (assignment) => {
    this._post(Object.assign(assignment, { type: "hnw-register-assigned-agent" }));
  };

  // (Object[Any]) => Unit
  relay = (payload) => {
    this._post(payload);
  };

  // (String) => Unit
  setOutput = (output) => {
    this._post({ type: "nlw-set-output", output });
  };

  // (Object[Any]) => Unit
  _onBabyMonitorMessage = (data) => {
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
    this.resetIDMan();
    this._getFrame().src = `${this._getFrame().src}`; // Refresh frame
  };

  // () => Unit
  _show = () => {
    const galaWindow = this._getFrame().contentWindow;
    spamFrameForPort(this._galaURL)(galaWindow)("hnw-set-up-baby-monitor").
      then(this._setBabyMonitor);
  };

}

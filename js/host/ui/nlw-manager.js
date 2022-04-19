import NLWManager from "/js/common/ui/nlw-manager.js";

export default class HostNLWManager extends NLWManager {

  #broadcast   = undefined; // (UUID, Boolean?) => RTCDataChannel?
  #narrowcast  = undefined; // () => Array[RTCDataChannel]
  #onError     = undefined; // (String) => Unit

  // (NEW): Ports from HNW outer frame to inner (accordion) iframes
  #commandCenterPort1 = undefined;
  #codeModalPort1 = undefined;
  #infoModalPort1 = undefined;

  // (Element, (String, Object[Any]?) => Unit, () => Array[RTCDataChannel], (String) => Unit) => HostNLWManager
  constructor(outerFrame, broadcast, narrowcast, onError) {
    super(outerFrame);
    this.#broadcast   = broadcast;
    this.#narrowcast  = narrowcast;
    this.#onError     = onError;
  }

  // (UUID, String) => Promise[Object[Any]]
  awaitJoinerInit = (token, username) => {
    const type = "hnw-request-initial-state";
    const msg  = { token, roleName: "student", username };
    return this._await(type, msg);
  };

  // () => Promise[Blob]
  awaitPreview = () => {
    return this._await("nlw-request-view");
  };

  // (UUID, Object[Any], String) => Unit
  becomeOracle = (uuid, props, nlogo) => {
    this._post({ ...props, type: "hnw-become-oracle", nlogo });
    this._post({ type: "nlw-subscribe-to-updates", uuid });

    const commandCenterChannel = new MessageChannel();
    const commandCenterFrame = this._getCommandCenterFrame();

    this.#commandCenterPort1 = commandCenterChannel.port1;
    this.#commandCenterPort1.onmessage = ({ data }) => {

        switch (data.type) {

          case "nlw-console-run": {
            const msg = { type: "hnw-console-run", code: data.code };
            this.relay(msg);
            break;
          }

          default: {
            console.warn("Unknown command center monitor message type:", data);
          }

      }
    }

    commandCenterFrame.onload = () => {
      const msg     = { type: "hnw-set-up-command-center", nlogo };
      const conWind = commandCenterFrame.contentWindow;
      conWind.postMessage(msg, this._galaURL, [commandCenterChannel.port2]);
    };

    commandCenterFrame.src = `${this._galaURL}/command-center`;

    const codeModalChannel = new MessageChannel();
    const codeModalFrame = this._getCodeModalFrame();

    this.#codeModalPort1 = codeModalChannel.port1;
    this.#codeModalPort1.onmessage = ({ data }) => {

      switch (data.type) {

        case "nlw-recompile": {
          const msg = { type: "hnw-recompile", code: data.callback };
          this.relay(msg);
          break;
        }

        case "nlw-recompile-lite": {
          const msg = { type: "hnw-recompile-lite", code: data.callback };
          this.relay(msg);
          break;
        }

        default: {
          console.warn("Unknown command center monitor message type:", data);
        }

    }
  }

    codeModalFrame.onload = () => {
      const msg     = { type: "hnw-set-up-code-modal", nlogo };
      const conWind = codeModalFrame.contentWindow;
      conWind.postMessage(msg, this._galaURL, [codeModalChannel.port2]);
    };

    codeModalFrame.src = `${this._galaURL}/code-modal`;

    const infoModalChannel = new MessageChannel();
    const infoModalFrame = this._getInfoModalFrame();
    this.#infoModalPort1 = infoModalChannel.port1;

    infoModalFrame.onload = () => {
      const msg     = { type: "hnw-set-up-info-modal", nlogo };
      const conWind = infoModalFrame.contentWindow;
      conWind.postMessage(msg, this._galaURL, [infoModalChannel.port2]);
    };

    infoModalFrame.src = `${this._galaURL}/info-modal`;
  };

  // (UUID) => Unit
  disown = (joinerID) => {
    this._post({ type: "hnw-notify-disconnect", joinerID });
  };

  // () => Unit
  init = () => {

    const babyMonitorChannel = new MessageChannel();
    this._setBabyMonitor(babyMonitorChannel.port1);

    const iframe = this._getFrame();

    iframe.onload = () => {
      const msg     = { type: "hnw-set-up-baby-monitor" };
      const conWind = iframe.contentWindow;
      conWind.postMessage(msg, this._galaURL, [babyMonitorChannel.port2]);
    };

    iframe.src = `${this._galaURL}/hnw-host`;
  };

  // () => Unit
  notifyCongested = () => {
    this._post({ type: "hnw-notify-congested" });
  };

  // () => Unit
  notifyUncongested = () => {
    this._post({ type: "hnw-notify-uncongested" });
  };

  // (Object[Any]) => Unit
  relay = (payload) => {
    this._post(payload);
  };

  // (UUID, Number) => Unit
  registerPingStats = (joinerID, ping) => {
    this._post({ type: "hnw-latest-ping", joinerID, ping });
  };

  // (Object[Any]) => Unit
  _onBabyMonitorMessage = (data) => {

    switch (data.type) {

      // (NEW): TODO
      case "nlw-code-modal-errors": {
        const msg = {type: "hnw-code-modal-errors", messages: data.messages}
        this.#codeModalPort1.postMessage(msg);
        break;
      }

      case "nlw-model-code": {
        const msg = { type: "hnw-model-code", code: data.code };
        this.#codeModalPort1.postMessage(msg);
        break;
      }

      case "nlw-model-info": {
        const msg = { type: "hnw-model-info", info: data.info };
        this.#infoModalPort1.postMessage(msg);
        break;
      }

      case "nlw-command-center-output": {
        const msg = { type: "hnw-command-center-output", newOutputLine: data.newOutputLine };
        this.#commandCenterPort1.postMessage(msg);
      }

      case "nlw-state-update": {
        if (data.isNarrowcast)
          this.#narrowcast(data.recipient, "state-update", { update: data.update });
        else
          this.#broadcast("state-update", { update: data.update });
        break;
      }

      case "relay": {
        const typ  = data.payload.type;
        const type = (typ === "nlw-state-update") ? "state-update" : typ;
        if (data.isNarrowcast) {
          const parcel = { ...data.payload };
          delete parcel.isNarrowcast;
          delete parcel.recipient;
          delete parcel.type;
          this.#narrowcast(data.recipient, type, parcel);
        } else {
          this.#broadcast(type, data.payload);
        }
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

}

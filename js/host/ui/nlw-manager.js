import NLWManager from "/js/common/ui/nlw-manager.js";

export default class HostNLWManager extends NLWManager {

  #broadcast   = undefined; // (UUID, Boolean?) => RTCDataChannel?
  #narrowcast  = undefined; // () => Array[RTCDataChannel]
  #onError     = undefined; // (String) => Unit

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

    // (NEW): Command center iframe setup
    this._setBabyMonitor(babyMonitorChannel.port2); // TODO: Maybe wrong???

    const commandCenterFrame = this._getCommandCenterFrame();

    commandCenterFrame.onload = () => {
      const msg     = { type: "hnw-set-up-command-center" };
      const conWind = commandCenterFrame.contentWindow;
      conWind.postMessage(msg, this._galaURL, [babyMonitorChannel.port1]); // TODO: Maybe wrong???
    };

    commandCenterFrame.src = `${this._galaURL}/command-center`;

    // (NEW): Code modal iframe setup
    this._setBabyMonitor(babyMonitorChannel.port1); // TODO: Maybe wrong???

    const codeModalFrame = this._getCodeModalFrame();

    codeModalFrame.onload = () => {
      const msg     = { type: "hnw-set-up-code-modal" };
      const conWind = codeModalFrame.contentWindow;
      conWind.postMessage(msg, this._galaURL, [babyMonitorChannel.port2]); // TODO: Maybe wrong???
    };

    codeModalFrame.src = `${this._galaURL}/code-modal`;

    // (NEW): Info modal iframe setup
    this._setBabyMonitor(babyMonitorChannel.port2); // TODO: Maybe wrong???

    const infoModalFrame = this._getInfoModalFrame();

    infoModalFrame.onload = () => {
      const msg     = { type: "hnw-set-up-info-modal" };
      const conWind = infoModalFrame.contentWindow;
      conWind.postMessage(msg, this._galaURL, [babyMonitorChannel.port1]); // TODO: Maybe wrong???
    };

    infoModalFrame.src = `${this._galaURL}/info-modal`;
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

import NLWManager from "/js/common/ui/nlw-manager.js";

export default class HostNLWManager extends NLWManager {

  #broadcast   = undefined; // (UUID, Boolean?) => RTCDataChannel?
  #launchModel = undefined; // (Object[Any]) => Unit
  #narrowcast  = undefined; // () => Array[RTCDataChannel]
  #onError     = undefined; // (String) => Unit

  // (Element, (Object[Any]) => Unit, (String, Object[Any]?) => Unit, () => Array[RTCDataChannel], (String) => Unit) => HostNLWManager
  constructor(outerFrame, launchModel, broadcast, narrowcast, onError) {
    super(outerFrame);
    this.#broadcast   = broadcast;
    this.#launchModel = launchModel;
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
  registerPing = (joinerID, ping) => {
    this._post({ type: "hnw-latest-ping", joinerID, ping });
  };

  _onBabyMonitorMessage = ({ data }) => {

    switch (data.type) {

      case "nlw-state-update": {
        if (data.isNarrowcast)
          this.#narrowcast(data.recipient, "state-update", { update: data.update });
        else
          this.#broadcast("state-update", { update: data.update });
        break;
      }

      case "galapagos-direct-launch": {
        const { nlogo, config, sessionName, password } = data;
        this.#launchModel({ modelType:  "upload"
                          , model:       nlogo
                          , sessionName
                          , password
                          , config
                          });
        break;
      }

      case "relay": {
        if (data.isNarrowcast) {
          const parcel = { ...data };
          delete parcel.isNarrowcast;
          delete parcel.recipient;
          this.#narrowcast(data.recipient, "relay", parcel);
        } else {
          this.#broadcast("relay", data);
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

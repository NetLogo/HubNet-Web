import NLWManager from "/js/common/ui/nlw-manager.js";

export default class HostNLWManager extends NLWManager {

  #getOpenChannelByID = undefined; // (UUID, Boolean?) => RTCDataChannel?
  #getOpenChannels    = undefined; // () => Array[RTCDataChannel]
  #initSesh           = undefined; // (UUID) => Unit
  #launchModel        = undefined; // (Object[Any]) => Unit
  #onError            = undefined; // (String) => Unit
  #postImageUpdate    = undefined; // (Blob) => Unit
  #rtcMan             = undefined; // RTCManager

  // ( Element, (Object[Any]) => Unit, (UUID) => Unit, (UUID, Boolean?) => RTCDataChannel?, () => Array[RTCDataChannel]
  // , (Blob) => Unit, (String) => Unit) => HostNLWManager
  constructor( outerFrame, rtcManager, launchModel, initSesh, getOpenChannelByID
             , getOpenChannels, postImage, onError) {

    super(outerFrame);

    this.#getOpenChannelByID = getOpenChannelByID;
    this.#getOpenChannels    = getOpenChannels;
    this.#initSesh           = initSesh;
    this.#launchModel        = launchModel;
    this.#onError            = onError;
    this.#postImageUpdate    = postImage;
    this.#rtcMan             = rtcManager;

  }

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

  // (UUID, String) => Unit
  initializeJoiner = (token, username) => {

    const type = "hnw-request-initial-state";
    const msg  = { token, roleName: "student", username };

    this._await(type, msg).
      then(({ role, state, viewState: view }) => {
        this.#narrowcast("initial-model", { role, token, state, view }, token);
        this.#initSesh(token);
      });

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

  // () => Unit
  updatePreview = () => {
    this._await("nlw-request-view").
      then(({ blob }) => { this.#postImageUpdate(blob); });
  };

  // (String, Object[Any]) => Unit
  #broadcast = (type, message) => {
    this.#rtcMan.sendBurst(...this.#getOpenChannels())(type, message);
  };

  // (String, Object[Any], UUID) => Unit
  #narrowcast = (type, message, recipientUUID) => {
    const channel = this.#getOpenChannelByID(recipientUUID, true);
    if (channel !== null) {
      this.#rtcMan.sendBurst(channel)(type, message);
    }
  };

  _onBabyMonitorMessage = ({ data }) => {

    switch (data.type) {

      case "nlw-state-update": {
        if (data.isNarrowcast)
          this.#narrowcast("state-update", { update: data.update }, data.recipient);
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
          this.#narrowcast("relay", parcel, data.recipient);
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

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

      case "nlw-view": {
        this.#postImageUpdate(data.blob);
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

      case "hnw-initial-state": {
        const { token, role, state, viewState: view } = data;
        this.#narrowcast("initial-model", { role, token, state, view }, token);
        this.#initSesh(token);
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

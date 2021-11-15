import { awaitPort, spamFrameForPort } from "/js/common/await.js";
import { galapagos, galaProto        } from "/js/common/domain.js";
import { sendBurst                   } from "/js/common/webrtc.js";

const galaURL = `${galaProto}://${galapagos}`;

export default class HostNLWManager {

  #babyMonitor        = null;      // MessagePort
  #getOpenChannelByID = undefined; // (UUID, Boolean?) => RTCDataChannel?
  #getOpenChannels    = undefined; // () => Array[RTCDataChannel]
  #initSesh           = undefined; // (UUID) => Unit
  #launchModel        = undefined; // (Object[Any]) => Unit
  #onError            = undefined; // (String) => Unit
  #outerFrame         = undefined; // Element
  #postImageUpdate    = undefined; // (Blob) => Unit
  #resolverQueue      = undefined; // Array[() => Unit]

  // ( Element, (Object[Any]) => Unit, (UUID) => Unit, (UUID, Boolean?) => RTCDataChannel?, () => Array[RTCDataChannel]
  // , (Blob) => Unit, (String) => Unit) => HostNLWManager
  constructor( outerFrame, launchModel, initSesh, getOpenChannelByID, getOpenChannels
             , postImage, onError) {
    this.#getOpenChannelByID = getOpenChannelByID;
    this.#getOpenChannels    = getOpenChannels;
    this.#initSesh           = initSesh;
    this.#launchModel        = launchModel;
    this.#onError            = onError;
    this.#outerFrame         = outerFrame;
    this.#postImageUpdate    = postImage;
    this.#resolverQueue      = [];
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
  };

  // () => Unit
  init = () => {

    const babyMonitorChannel = new MessageChannel();
    this.#setBabyMonitor(babyMonitorChannel.port1);

    const iframe = this.#outerFrame.querySelector("iframe");

    iframe.onload = () => {
      const msg     = { type: "hnw-set-up-baby-monitor" };
      const conWind = iframe.contentWindow;
      conWind.postMessage(msg, galaURL, [babyMonitorChannel.port2]);
    };

    iframe.src = `${galaURL}/hnw-host`;

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
      then(this.#setBabyMonitor);

  };

  // (String, Object[Any]) => Unit
  #broadcast = (type, message) => {
    sendBurst(true, ...this.#getOpenChannels())(type, message);
  };

  // (String, Object[Any], UUID) => Unit
  #narrowcast = (type, message, recipientUUID) => {
    const channel = this.#getOpenChannelByID(recipientUUID, true);
    if (channel !== null) {
      sendBurst(true, channel)(type, message);
    }
  };

  // (MessagePort) => Unit
  #setBabyMonitor = (bm) => {

    this.#babyMonitor = bm;
    this.#resolverQueue.forEach((f) => f());
    this.#resolverQueue = [];

    bm.onmessage = ({ data }) => {

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

import NLWManager from "/js/common/ui/nlw-manager.js";

// type Button = HTMLButtonElement
// type Frame  = HTMLIFrameElement

export default class HostNLWManager extends NLWManager {

  #broadcast           = undefined; // (UUID, Boolean?) => RTCDataChannel?
  #goButton            = undefined; // HTMLButtonElement
  #narrowcast          = undefined; // () => Array[RTCDataChannel]
  #onError             = undefined; // (String) => Unit
  #onPersistentClients = undefined; // (Array[Number]) => Unit
  #onRoleInfo          = undefined; // (Array[Object[Any]]) => Unit

  #comCenPort   = undefined; // MessagePort
  #codePanePort = undefined; // MessagePort
  #infoPanePort = undefined; // MessagePort

  // ( Element, Button, Button, (String, Object[Any]?) => Unit
  // , () => Array[RTCDataChannel], (Array[Number]) => Unit
  // , (Array[Object[Any]]) => Unit, (String) => Unit) => HostNLWManager
  constructor( outerFrame, setupButton, goButton, broadcast
             , narrowcast, onPersistentClients
             , onRoleInfo, onError) {

    super(outerFrame);

    this.#broadcast           = broadcast;
    this.#goButton            = goButton;
    this.#narrowcast          = narrowcast;
    this.#onError             = onError;
    this.#onPersistentClients = onPersistentClients;
    this.#onRoleInfo          = onRoleInfo;

    setUpSetup(setupButton, this.relay);
    setUpGo   (   goButton, this.relay);

  }

  // (UUID, String, Number) => Promise[Object[Any]]
  awaitJoinerInit = (token, username, roleIndex) => {
    const type = "hnw-request-initial-state";
    const msg  = { token, username, roleIndex };
    return this._await(type, msg);
  };

  // () => Promise[Blob]
  awaitPreview = () => {
    return this._await("nlw-request-view");
  };

  // (UUID, Object[Any], String) => Unit
  becomeOracle = (uuid, props, nlogo) => {

    const ccFrame = this._querySelector("#command-center-iframe");
    this.#comCenPort = setUpComCen(nlogo, ccFrame, this._galaURL, this.relay);

    const codeFrame = this._querySelector("#model-code-iframe");
    this.#codePanePort = setUpCodePane(nlogo, codeFrame, this._galaURL, this.relay);

    const infoFrame = this._querySelector("#model-info-iframe");
    this.#infoPanePort = setUpInfoPane(nlogo, infoFrame, this._galaURL);

    this._post({ ...props, type: "hnw-become-oracle", nlogo });
    this._post({ type: "nlw-subscribe-to-updates", uuid });

    if (props.onIterate !== null) {
      this.#goButton.classList.remove("hidden");
    } else {
      this.#goButton.classList.add("hidden");
    }

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

      case "hnw-stop-iterating": {
        this.#goButton.click();
        break;
      }

      case "hnw-role-config": {
        this.#onRoleInfo(data.roles);
        break;
      }

      case "hnw-persistent-clients": {
        this.#onPersistentClients(data.pops);
        break;
      }

      case "nlw-recompile-success": {
        const msg = { type: "hnw-recompile-success", code: data.code };
        this.#codePanePort.postMessage(msg);
        break;
      }

      case "nlw-recompile-failure": {
        const msg = { type: "hnw-recompile-failure", messages: data.messages };
        this.#codePanePort.postMessage(msg);
        break;
      }

      case "nlw-model-code": {
        const msg = { type: "hnw-model-code", code: data.code };
        this.#codePanePort.postMessage(msg);
        break;
      }

      case "nlw-model-info": {
        const msg = { type: "hnw-model-info", info: data.info };
        this.#infoPanePort.postMessage(msg);
        break;
      }

      case "nlw-command-center-output": {
        const type = "hnw-command-center-output";
        const msg  = { type, newOutputLine: data.newOutputLine };
        this.#comCenPort.postMessage(msg);
        break;
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

// (String, Frame, String, (Object[Any]) => Unit, String, String) => MessagePort
const setUpPane = (nlogo, frame, url, onMsg, onloadType, urlSuffix) => {

  const channel = new MessageChannel();
  const port    = channel.port1;

  if (onMsg !== undefined) {
    port.onmessage = onMsg;
  }

  frame.onload = () => {
    const msg = { type: onloadType, nlogo };
    frame.contentWindow.postMessage(msg, url, [channel.port2]);
  };

  frame.src = `${url}/${urlSuffix}`;

  return port;

};

// (String, Frame, String) => MessagePort
const setUpInfoPane = (nlogo, frame, url) => {
  const onloadType = "hnw-set-up-info-pane";
  const urlSuffix  = "info-pane";
  return setUpPane(nlogo, frame, url, undefined, onloadType, urlSuffix);
};

// (String, Frame, String, (Object[Any]) => Unit) => MessagePort
const setUpCodePane = (nlogo, frame, url, relay) => {

  const onMsg = ({ data }) => {
    switch (data.type) {
      case "nlw-recompile": {
        const msg = { type: "hnw-recompile", code: data.code };
        relay(msg);
        break;
      }
      default: {
        console.warn("Unknown code pane message type:", data.type, data);
      }
    }
  };

  const onloadType = "hnw-set-up-code-pane";
  const urlSuffix  = "code-pane";

  return setUpPane(nlogo, frame, url, onMsg, onloadType, urlSuffix);

};

// (String, Frame, String, (Object[Any]) => Unit) => MessagePort
const setUpComCen = (nlogo, frame, url, relay) => {

  const onMsg = ({ data }) => {
    switch (data.type) {
      case "nlw-console-run": {
        const msg = { type: "hnw-console-run", code: data.code };
        relay(msg);
        break;
      }
      default: {
        console.warn("Unknown command center message type:", data.type, data);
      }
    }
  };

  const onloadType = "hnw-set-up-command-center";
  const urlSuffix  = "command-center-pane";

  return setUpPane(nlogo, frame, url, onMsg, onloadType, urlSuffix);

};

// (Button, (Object[Any]) => Unit) => Unit
const setUpSetup = (setupButton, relay) => {
  setupButton.onclick = () => {
    relay({ type: "hnw-setup-button" });
  };
};

// (Button, (Object[Any]) => Unit) => Unit
const setUpGo = (goButton, relay) => {

  goButton.onclick = () => {

    const goWasActive = goButton.classList.contains("go-button-active");

    const [remove, add, text, goStatus] =
      goWasActive ? ["go-button-active"  , "go-button-standard", "Go"  , false]
                  : ["go-button-standard", "go-button-active"  , "Stop", true ];

    goButton.classList.remove(remove);
    goButton.classList.add   (add);
    goButton.innerText = text;
    relay({ type: "hnw-go-checkbox", goStatus });

  };

};

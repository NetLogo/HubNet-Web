import usePlaceholderPreview from "./use-placeholder-preview.js";

import * as CompressJS from "./compress.js";

const sendRTC = CompressJS.sendRTC(false);

// (() => Unit) => Unit
const switchToNLW = (notifyLoggedIn) => {

  document.querySelector(".session-option").checked = false;
  usePlaceholderPreview();

  const formFrame = document.getElementById("server-browser-frame");
  const galaFrame = document.getElementById(           "nlw-frame");
  formFrame.classList.add(   "hidden");
  galaFrame.classList.remove("hidden");

  self.history.pushState({ name: "joined" }, "joined");
  notifyLoggedIn();

};

// ( () => Promise[RTCStatsReport], Protocol.Channel, () => Unit
// , () => Unit, () => Unit) => Object[Any]
export default (bundle) => {

  const unlockUI = () => {
    document.getElementById("join-button").disabled = false;
  };

  const disconnect = () => {
    bundle.channel.close(1000, "The host disconnected.  Awaiting new selection.");
  };

  const handleLogin = () => {
    bundle.closeSignaling();
    bundle.closeServerListSocket();
    switchToNLW(bundle.notifyLoggedIn);
  };

  const setConnectionType = (ct) => {
    document.getElementById("connection-type-span").innerText = ct;
  };

  const setLatency = (lat) => {
    document.getElementById("latency-span").innerText = lat;
  };

  return { disconnect
         , disconnectChannels:      bundle.disconnectChannels
         , enqueue:                 bundle.enqueue
         , getConnectionStats:      bundle.getConnectionStats
         , handleIncorrectPassword: unlockUI
         , handleLogin
         , handleMissingUsername:   unlockUI
         , handleUsernameIsTaken:   unlockUI
         , notifyUser:              alert
         , send:                    sendRTC(bundle.channel)
         , setConnectionType
         , setLatency
         , setStatus:               bundle.setStatus
         };

};

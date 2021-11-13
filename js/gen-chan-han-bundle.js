// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

// (Object[Any]) => (Object[Any]) => Object[Any]
export default (rootBundle) => (connBundle) => {

  const handleLogin = () => {

    connBundle.closeSignaling();
    rootBundle.closeSessionListSocket();
    rootBundle.useDefaultPreview();

    const options = Array.from(document.querySelectorAll(".session-option"));
    options.forEach((o) => { o.checked = false; });

    byEID("session-browser-frame").classList.add("hidden");
    rootBundle.showNLW();

    self.history.pushState({ name: "joined" }, "joined");
    rootBundle.notifyLoggedIn();

  };

  const setConnectionType = (ct) => {
    byEID("connection-type-span").innerText = ct;
  };

  const setLatency = (lat) => {
    byEID("latency-span").innerText = lat;
  };

  return { disconnect:              connBundle.disconnect
         , enqueue:                 rootBundle.enqueue
         , getConnectionStats:      connBundle.getConnectionStats
         , handleIncorrectPassword: rootBundle.unlockUI
         , handleLogin
         , handleMissingUsername:   rootBundle.unlockUI
         , handleUsernameIsTaken:   rootBundle.unlockUI
         , notifyUser:              alert
         , send:                    connBundle.send
         , setConnectionType
         , setLatency
         , statusManager:           rootBundle.statusManager
         , terminate:               connBundle.terminate
         };

};

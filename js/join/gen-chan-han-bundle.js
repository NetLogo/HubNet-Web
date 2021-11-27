// (Object[Any]) => (Object[Any]) => Object[Any]
export default (rootBundle) => (connBundle) => {

  const handleLogin = () => {

    connBundle.closeSignaling();
    rootBundle.hibernateSessionList();
    rootBundle.useDefaultPreview();

    byEID("session-browser-frame").classList.add("hidden");
    rootBundle.showNLW();

    self.history.pushState({ name: "joined" }, "joined");
    rootBundle.notifyLoggedIn();

  };

  const setConnectionType = (ct) => {
    byEID("connection-type-span").innerHTML = ct;
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
         , notifyUser:              (s) => { alert(s); }
         , send:                    connBundle.send
         , setConnectionType
         , setLatency
         , statusManager:           rootBundle.statusManager
         , terminate:               connBundle.terminate
         };

};

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

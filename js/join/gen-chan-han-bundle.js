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

  // ((Boolean, Boolean)) => Unit
  const setConnectionType = ([receivesOverTURN, sendsOverTURN]) => {

    const rx = receivesOverTURN;
    const tx =    sendsOverTURN;

    const [clazz, text] =
      (rx  &&  tx) ? ["conn-worst",  "Fully Server-Based"] :
      (rx  && !tx) ? ["conn-worse", "Mostly Server-Based"] :
      (!rx &&  tx) ? ["conn-bad"  , "Mostly Peer-to-Peer"] :
                     ["conn-good" ,  "Fully Peer-to-Peer"];

    byEID("connection-type-span").className = clazz;
    byEID("connection-type-span").innerText = text;

  };

  const setLatency = (lat) => {
    byEID("latency-span").innerText = lat;
  };

  return { addChatLine:             rootBundle.addChatLine
         , disconnect:              connBundle.disconnect
         , enqueue:                 rootBundle.enqueue
         , getConnectionStats:      connBundle.getConnectionStats
         , handleIncorrectPassword: rootBundle.unlockUI
         , handleLogin
         , handleMissingUsername:   rootBundle.unlockUI
         , handleUsernameIsTaken:   rootBundle.unlockUI
         , notifyUser:              (s) => { alert(s); }
         , resetConn:               connBundle.resetConn
         , send:                    connBundle.send
         , setConnectionType
         , setLatency
         , statusManager:           rootBundle.statusManager
         , terminate:               connBundle.terminate
         };

};

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

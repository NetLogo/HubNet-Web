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

  // ((Boolean?, Boolean?)) => Unit
  const setConnectionType = ([receivesOverTURN, sendsOverTURN]) => {

    const rx = receivesOverTURN;
    const tx =    sendsOverTURN;

    const isValid = rx !== undefined && tx !== undefined;

    const [clazz, text] =
      (rx  &&  tx) ? ["conn-worst",  "Fully Server-Based"] :
      (rx  && !tx) ? ["conn-worse", "Mostly Server-Based"] :
      (!rx &&  tx) ? ["conn-bad"  , "Mostly Peer-to-Peer"] :
      isValid      ? ["conn-good" ,  "Fully Peer-to-Peer"] :
                     ["conn-worst",    "Unable to Detect"];

    byEID("connection-type-span").className = clazz;
    byEID("connection-type-span").innerText = text;

  };

  const setLatency = (lat) => {
    byEID("latency-span").innerText = lat;
  };

  const setNumClients = (num) => {
    byEID("client-num-span").innerText = num;
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
         , registerAssignedAgent:   rootBundle.registerAssignedAgent
         , resetConn:               connBundle.resetConn
         , send:                    connBundle.send
         , setConnectionType
         , setLatency
         , setNumClients
         , statusManager:           rootBundle.statusManager
         , terminate:               connBundle.terminate
         };

};

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

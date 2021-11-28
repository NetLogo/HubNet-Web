import ConnectionManager    from "./conn/connection-manager.js";

import BurstQueue           from "./burst-queue.js";
import AppStatusManager     from "./ui/app-status-manager.js";
import LoginControlsManager from "./ui/login-controls-manager.js";
import NLWManager           from "./ui/nlw-manager.js";
import PreviewManager       from "./ui/preview-manager.js";
import SessionList          from "./ui/session/session-list.js";

import genCHB from "./gen-chan-han-bundle.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

// String
const usernameLSKey = "hnw.global.username";

// (String, String) => Unit
const onLogIn = (username, password) => {

  statusManager.connecting();

  const hostID = sessionList.getSelectedUUID();

  const onDoorbell = () => requestAnimationFrame(burstQueue.run);

  const rootCHBundle =
    { enqueue:                burstQueue.enqueue
    , hibernateSessionList:   sessionList.hibernate
    , notifyLoggedIn:         burstQueue.setStateLoggedIn
    , showNLW:                nlwManager.show
    , statusManager
    , unlockUI:               loginControls.reset
    , useDefaultPreview:      previewManager.useDefault
    };

  const genCHBundle = genCHB(rootCHBundle);

  const notifyFull = () => {
    alert("The selected session is currently full.  Please wait a bit before trying again, or choose another session.");
  };

  window.localStorage.setItem(usernameLSKey, username);

  fetch(`/rtc/join/${hostID}`).
    then((response) => response.text()).
    then(connMan.logIn( hostID, username, password, genCHBundle
                      , statusManager.loggingIn, statusManager.iceConnectionLost
                      , onDoorbell, alert, notifyFull, cleanupSession));

};

// ((UUID) => Session?) => Unit
const processURLHash = (clickAndGetByUUID) => {

  if (self.location.hash !== "") {

    const trueHash             = self.location.hash.slice(1);
    const [oracleID, username] = trueHash.split(",", 2);
    const session              = clickAndGetByUUID(oracleID);

    if (session !== undefined) {

      const initialName = username || loginControls.getUsername();

      const hasUsername = initialName !== undefined;

      const finalUsername =
        hasUsername ? initialName : prompt("Please enter your login name");

      loginControls.setUsername(finalUsername);

      if (session.hasPassword) {
        loginControls.setPassword(prompt("Please enter the room's password"));
      }

      loginControls.join();

    }

  }

};

// () => BurstQueue
const genBurstQueue = () => {

  const onFail = () => {
    alert("Sorry.  Something went wrong when trying to load the model.  Please try again.");
    cleanupSession(false, statusManager.failedToLoadModel);
  };

  const burstBundle =
    { awaitLoadInterface: nlwManager.awaitLoadInterface
    , getUsername:        loginControls.getUsername
    , relayToNLW:         nlwManager.relay
    , statusManager
    , updateNLW:          nlwManager.postUpdate
    };

  const loop = (f) => { requestAnimationFrame(f); };

  return new BurstQueue(burstBundle, loop, statusManager.downloadingModel, onFail);

};

// (Boolean, () => Unit) => Unit
const cleanupSession = (warrantsExplanation, updateStatus = () => {}) => {

  connMan.reset();
  burstQueue?.halt();

  byEID("session-browser-frame").classList.remove("hidden");
  nlwManager.hide();
  sessionList.enable();
  loginControls.reset();

  if (warrantsExplanation) {
    alert("Connection to host lost");
  }

  updateStatus();

};

// (String) => Unit
const onHNWError = (type) => {
  switch (type) {
    case "unknown-agent": {
      alert(`We received an update for an agent that we have never heard of (${event.data.agentType} #${event.data.agentID}).\n\nIn a later version, we will add the ability to resynchronize with the server to get around this issue.  However, the only solution right now is for the activity to close.\n\nYou might have better success if you reconnect.`);
      break;
    }
    default: {
      alert(`A fatal error occurred: ${event.data.subtype}`);
    }
  }
  statusManager.closedFromError();
  cleanupSession(false);
};

const loginControls  = new LoginControlsManager(byEID("join-form"), onLogIn);
const previewManager = new       PreviewManager(byEID("session-preview-image"));
const statusManager  = new     AppStatusManager(byEID("status-value"));

document.addEventListener("DOMContentLoaded", () => {
  const username = window.localStorage.getItem(usernameLSKey);
  loginControls.setUsername(username || "");
});

const sessionList =
  new SessionList(byEID("session-list-container"), processURLHash, statusManager
                 , previewManager
                 , loginControls.onNewSelection(() => document.createElement("option")));

const connMan    = new ConnectionManager();
const nlwManager = new NLWManager( byEID("nlw-frame"), connMan.send
                                 , connMan.disconnect, onHNWError);
const burstQueue = genBurstQueue(); // BurstQueue

document.addEventListener("DOMContentLoaded", nlwManager.init);

self.addEventListener("beforeunload", () => {
  // Honestly, this will probably not run before the tab closes.
  // Not much I can do about that.  --Jason B. (8/21/20)
  connMan.disconnect();
});

self.addEventListener("popstate", (event) => {
  if (event.state !== null && event.state !== undefined) {
    switch (event.state.name) {
      case "joined": {
        connMan.reset();
        cleanupSession(false);
        break;
      }
      default: {
        console.warn("Unknown state:", event.state.name);
      }
    }
  }
});

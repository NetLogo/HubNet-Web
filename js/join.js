import AppStatusManager  from "./app-status-manager.js";
import BurstQueue        from "./burst-queue.js";
import ConnectionManager from "./connection-manager.js";
import NLWManager        from "./nlw-manager.js";
import PreviewManager    from "./preview-manager.js";
import SessionList       from "./session-list.js";

import genCHB from "./gen-chan-han-bundle.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

let burstQueue = undefined; // BurstQueue

// ((UUID) => Session?) => Unit
const processURLHash = (clickAndGetByUUID) => {

  if (self.location.hash !== "") {
    const trueHash             = self.location.hash.slice(1);
    const [oracleID, username] = trueHash.split(",", 2);
    const session              = clickAndGetByUUID(oracleID);
    if (session !== undefined) {
      const hasUsername = username !== undefined;
      byEID("username").value =
        hasUsername ? username : prompt("Please enter your login name");
      if (session.hasPassword) {
        byEID("password").value =
          prompt("Please enter the room's password");
      }
      byEID("join-button").click();
    }
  }

};

// (SessionData, Element, UUID) => Unit
const notifyNewSelection = (seshData, activeElem, prevUUID) => {

  const activeUUID  = (activeElem !== null) ? activeElem.dataset.uuid     : null;
  const activeEntry = (activeElem !== null) ? seshData.lookup(activeUUID) : null;
  const hasActive   = activeEntry !== null;

  const passwordInput    = byEID("password");
  passwordInput.disabled = hasActive ? !activeEntry.hasPassword : true;

  if (activeElem === null || prevUUID !== activeUUID) {
    passwordInput.value = "";
  }

  const roleSelect     = byEID("role-select");
  roleSelect.disabled  = !hasActive;
  roleSelect.innerHTML = "";

  if (hasActive) {
    activeEntry.roleInfo.forEach(
      ([roleName, current, max]) => {
        const node        = document.createElement("option");
        const isUnlimited = max === 0;
        node.disabled     = !isUnlimited && current >= max;
        node.innerText    = isUnlimited ? `${roleName} | ${current}` : `${roleName} | ${current}/${max}`;
        node.value        = roleName;
        roleSelect.appendChild(node);
      }
    );
  }

  // TODO: Better criteria later (especially the # of slots open in session)
  // --Jason B. (6/12/19)
  byEID("join-button").disabled = !hasActive;

};

const previewManager = new PreviewManager(byEID("session-preview-image"));

const statusManager = new AppStatusManager(byEID("status-value"));

const sessionList =
  new SessionList(byEID("session-list-container"), processURLHash, statusManager
                 , previewManager, notifyNewSelection);

byEID("join-form").addEventListener("submit", () => {

  statusManager.connecting();

  byEID("join-button").disabled = true;

  const username = byEID("username").value;
  const password = byEID("password").value;

  const hostID = sessionList.getSelectedUUID();

  burstQueue = genBurstQueue();

  const rootCHBundle =
    { closeSessionListSocket: sessionList.hibernate
    , enqueue:                burstQueue.enqueue
    , notifyLoggedIn:         burstQueue.setStateLoggedIn
    , showNLW:                nlwManager.show
    , statusManager
    , useDefaultPreview:      previewManager.useDefault
    };

  const genCHBundle = genCHB(rootCHBundle);

  fetch(`/rtc/join/${hostID}`).
    then((response) => response.text()).
    then(connMan.logIn( hostID, username, password, genCHBundle
                      , statusManager.loggingIn, statusManager.iceConnectionLost
                      , alert, cleanupSession));

});

// () => BurstQueue
const genBurstQueue = () => {

  const onFail = () => {
    alert("Sorry.  Something went wrong when trying to load the model.  Please try again.");
    cleanupSession(false, statusManager.failedToLoadModel);
  };

  const burstBundle =
    { awaitNLW:    nlwManager.await
    , getUsername: () => byEID("username").value
    , postToNLW:   nlwManager.post
    , spamNLW:     nlwManager.spam
    , statusManager
    };

  const loop = (f) => { requestAnimationFrame(f); };

  const bq = new BurstQueue( burstBundle, loop, statusManager.downloadingModel
                           , onFail);

  loop(bq.run);

  return bq;

};

// (Boolean, () => Unit) => Unit
const cleanupSession = (warrantsExplanation, updateStatus = () => {}) => {

  connMan.reset();
  burstQueue?.halt();

  byEID("session-browser-frame").classList.remove("hidden");
  nlwManager.hide();
  sessionList.enable();
  byEID("join-button").disabled = false;

  if (warrantsExplanation) {
    alert("Connection to host lost");
  }

  updateStatus();

};

const connMan = new ConnectionManager();

const nlwManager = new NLWManager(byEID("nlw-frame"), connMan.disconnect);

document.addEventListener("DOMContentLoaded", nlwManager.init);

// (MessageEvent) => Unit
self.addEventListener("message", (event) => {
  switch (event.data.type) {

    case "relay": {
      connMan.send("relay", event.data);
      break;
    }

    case "hnw-fatal-error": {
      switch (event.data.subtype) {
        case "unknown-agent": {
          alert(`We received an update for an agent that we have never heard of (${event.data.agentType} #${event.data.agentID}).\n\nIn a later version, we will add the ability to resynchronize with the server to get around this issue.  However, the only solution right now is for the activity to close.\n\nYou might have better success if you reconnect.`);
          break;
        }
        default: {
          alert(`An unknown fatal error has occurred: ${event.data.subtype}`);
        }
      }
      statusManager.closedFromError();
      cleanupSession(false);
      break;
    }

    case "hnw-resize": {
      break;
    }

    default: {
      console.warn(`Unknown message type: ${event.data.type}`);
    }

  }
});

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
        console.warn(`Unknown state: ${event.state.name}`);
      }
    }
  }
});

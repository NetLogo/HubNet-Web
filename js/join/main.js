import ConnectionManager    from "./conn/connection-manager.js";

import BurstQueue           from "./burst-queue.js";
import AppStatusManager     from "./ui/app-status-manager.js";
import LoginControlsManager from "./ui/login-controls-manager.js";
import NLWManager           from "./ui/nlw-manager.js";
import PreviewManager       from "./ui/preview-manager.js";
import SessionList          from "./ui/session/session-list.js";

import genCHB from "./gen-chan-han-bundle.js";

import ChatManager from "/js/common/ui/chat-manager.js";

import { deserialize } from "/js/serialize/xserialize-root.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

// String
const usernameLSKey = "hnw.global.username";

let role = undefined; // Role

const closedChatBox    = byEID("chat-box-closed");               // Element
const chatBottom       = byEID("chat-box-closed-bottom");        // Element
const chatBottomBorder = byEID("chat-box-closed-bottom-border"); // Element
const openChatBox      = byEID("chat-box-open");                 // Element
const openChatHeader   = byEID("open-chat-header");              // Element

const markChatUnread = (isRelevant, chatManager) => {

  if (isRelevant) {

    closedChatBox.classList.add("unread");
    chatBottom   .classList.add("unread");

    const messages          = chatManager.getUnreadMessages().toString();
    closedChatBox.innerHTML = `Unread: ${messages}`;

  }

};

// () => Unit
const markGlobalChatUnread = () => {
  const isGlobalChat = byEID("nlw-frame").classList.contains("hidden");
  markChatUnread(isGlobalChat, globalChatManager);
};

// () => Unit
const markSessionChatUnread = () => {
  const isSessionChat = !byEID("nlw-frame").classList.contains("hidden");
  markChatUnread(isSessionChat, sessionChatManager);
};

// () => Unit
const markChatRead = () => {
  closedChatBox.classList.remove("unread");
  chatBottom   .classList.remove("unread");
  closedChatBox.innerHTML = "Chat";
};

// (String, String, Number, String, String) => Unit
const onLogIn = (username, password, roleIndex, sessionName, activityName) => {

  statusManager.connecting();
  sessionChatManager.markAllMessagesRead();

  byEID("modal-session-name").innerHTML =  sessionName;
  byEID(     "activity-name").innerHTML = activityName;

  const hostID = sessionList.getSelectedUUID();

  const onDoorbell = () => {
    byEID( "global-chat").classList.add(   "hidden");
    byEID("session-chat").classList.remove("hidden");
    requestAnimationFrame(burstQueue.run);
  };

  const rootCHBundle =
    { addChatLine:            sessionChatManager.addNewChat
    , enqueue:                burstQueue.enqueue
    , hibernateSessionList:   sessionList.hibernate
    , notifyLoggedIn:         burstQueue.setStateLoggedIn
    , registerAssignedAgent:  nlwManager.registerAssignedAgent
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
    then(connMan.logIn( hostID, username, password, roleIndex, genCHBundle
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

      const hasUsername = initialName !== undefined && initialName !== "";

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
    { appendOutput:       nlwManager.appendOutput
    , awaitLoadInterface: nlwManager.awaitLoadInterface
    , getRoleDataP
    , getUsername:        loginControls.getUsername
    , relayToNLW:         nlwManager.relay
    , setOutput:          nlwManager.setOutput
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

  const nlwFrame = byEID("nlw-frame");
  delete nlwFrame.dataset.sessionName;
  delete nlwFrame.dataset.activityName;

  if (warrantsExplanation) {
    alert("Connection to host lost");
  }

  updateStatus();

};

// (String) => Unit
const onHNWError = (type) => {
  switch (type) {
    case "unknown-agent": {
      alert(`Invalid activity state detected.  Please report this error by e-mail to bugs@ccl.northwestern.edu.

Include as much of the following information as you can:

  Which model was being used.
  What actions the participants in the activity took, leading up to the error.
  Which browser and version the error occurred in.
  The error message: "Invalid activity state detected."

You can reconnect to the activity, but you are likely to encounter this error again, until a new version of HubNet Web can be released.`);
      break;
    }
    default: {
      alert(`A fatal error occurred: ${event.data.subtype}`);
    }
  }
  statusManager.closedFromError();
  cleanupSession(false);
};

const onSessionDisconnect = () => {
  connMan.disconnect();
  byEID( "global-chat").classList.remove("hidden");
  byEID("session-chat").classList.add(   "hidden");
  sessionChatManager.clear();
};

const loginControls  = new LoginControlsManager(byEID("join-form"), byEID("nlw-frame").dataset, onLogIn);
const previewManager = new       PreviewManager(byEID("session-preview-image"));
const statusManager  = new     AppStatusManager(byEID("status-value"));

document.addEventListener("DOMContentLoaded", () => {

  const expandChatBox = () => {

    openChatBox.classList.remove("invisible");
    closedChatBox   .classList.add("invisible");
    chatBottom      .classList.add("invisible");
    chatBottomBorder.classList.add("invisible");

    const globalChatView = byEID("nlw-frame").classList.contains("hidden");

    if (globalChatView) {
      globalChatManager.markAllMessagesRead();
    } else {
      sessionChatManager.markAllMessagesRead();
    }

  };

  closedChatBox   .onclick = () => expandChatBox();
  chatBottom      .onclick = () => expandChatBox();
  chatBottomBorder.onclick = () => expandChatBox();

  openChatHeader.onclick = () => {
    openChatBox     .classList.add("invisible");
    closedChatBox   .classList.remove("invisible");
    chatBottom      .classList.remove("invisible");
    chatBottomBorder.classList.remove("invisible");
  };

  const modalContainer = byEID("modal-container");

  const showModal = () => {
    modalContainer.classList.remove("modal-invis");
  };

  const hideModal = () => {
    modalContainer.classList.add("modal-invis");
  };

  window.onclick = (event) => {
    if (event.target === modalContainer) {
      hideModal();
    }
  };

  byEID("view-details-button").onclick = () => {
    showModal();
  };

  byEID("close-modal-button").onclick = () => {
    hideModal();
  };

  document.addEventListener("keydown", (event) => {
    const modalIsInvis = modalContainer.classList.contains("modal-invis");
    if (!modalIsInvis && event.key === "Escape") {
      hideModal();
    }
  });

  const username = window.localStorage.getItem(usernameLSKey);
  loginControls.setUsername(username || "");

});

// (UUID, Number) => Unit
const fetchRoleData = (hostID, roleIndex) => {
  fetch(`/role-data/${hostID}/${roleIndex}`).then((res) => res.text()).then(
    (data) => {
      const byteString = atob(data);
      const empty      = new Uint8Array(byteString.length);
      const bytes      = empty.map((_, i) => byteString.charCodeAt(i));
      role             = deserialize(false, false)(bytes);
    }
  );
};

// () => Promise[Role]
const getRoleDataP = () => {
  const promise =
    new Promise(
      (resolve) => {
        const poll = () => role !== undefined ? resolve(role) : setTimeout(poll);
        poll();
      }
    );
  return promise;
};

const sessionList =
  new SessionList( byEID("session-list-container"), byEID("session-filter-box")
                 , processURLHash, statusManager, previewManager
                 , loginControls.onNewSelection(() => document.createElement("option")));

const sessionChatManager =
  new ChatManager( byEID("session-chat-output"), byEID("session-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); }
                 , markSessionChatUnread
                 , markChatRead);

sessionChatManager.onSend((message) => { connMan.send("chat", { message }); });

const globalChatManager =
  new ChatManager( byEID("global-chat-output"), byEID("global-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); }
                 , markGlobalChatUnread
                 , markChatRead);

const connMan    = new ConnectionManager(globalChatManager, fetchRoleData);
const nlwManager = new NLWManager( byEID("nlw-frame"), connMan.send
                                 , onSessionDisconnect, onHNWError);
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
        cleanupSession(false);
        break;
      }
      default: {
        console.warn("Unknown state:", event.state.name);
      }
    }
  }
});

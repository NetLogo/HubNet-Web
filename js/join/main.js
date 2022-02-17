import ConnectionManager    from "./conn/connection-manager.js";

import BurstQueue           from "./burst-queue.js";
import AppStatusManager     from "./ui/app-status-manager.js";
import LoginControlsManager from "./ui/login-controls-manager.js";
import NLWManager           from "./ui/nlw-manager.js";
import PreviewManager       from "./ui/preview-manager.js";
import SessionList          from "./ui/session/session-list.js";

import genCHB from "./gen-chan-han-bundle.js";

import ChatManager from "/js/common/ui/chat-manager.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

// String
const usernameLSKey = "hnw.global.username";

const closedChatBox       = byEID("chat-box-closed");        // Element
const closedChatBoxBottom = byEID("chat-box-closed-bottom"); // Element
const openChatBox         = byEID("chat-box-open");          // Element
const openChatHeader      = byEID("open-chat-header");       // Element

// () => Unit
const updateGlobalChatUnread = () => {
  const globalChatView = !byEID( "global-chat").classList.contains("hidden");
  if (globalChatView) {
    closedChatBox.classList.remove("chat-box-read");
    closedChatBox.classList.add("chat-box-unread");
    closedChatBoxBottom.classList.remove("chat-box-bottom-read");
    closedChatBoxBottom.classList.add("chat-box-bottom-unread");

    closedChatBox.innerHTML = `Unread: ${globalChatManager.getUnreadMessages().toString()}`;
  }
};

// () => Unit
const updateSessionChatUnread = () => {
  const sessionChatView = byEID("global-chat").classList.contains("hidden");

  if (sessionChatView) {
    closedChatBox.classList.remove("chat-box-read");
    closedChatBox.classList.add("chat-box-unread");
    closedChatBoxBottom.classList.remove("chat-box-bottom-read");
    closedChatBoxBottom.classList.add("chat-box-bottom-unread");

    closedChatBox.innerHTML = `Unread: ${sessionChatManager.getUnreadMessages().toString()}`;
  }
};

// () => Unit
const updateChatRead = () => {
  closedChatBox.classList.remove("chat-box-unread");
  closedChatBox.classList.add("chat-box-read");
  closedChatBoxBottom.classList.remove("chat-box-bottom-unread");
  closedChatBoxBottom.classList.add("chat-box-bottom-read");

  closedChatBox.innerHTML = "Chat";
};

// (String, String, String, String) => Unit
const onLogIn = (username, password, sessionName, activityName) => {

  statusManager.connecting();
  sessionChatManager.markAllMessagesRead();

  byEID("modal-session-name").innerHTML = `${sessionName}`;
  byEID("modal-activity-name").innerHTML = activityName;

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

  const estabConn = () => {
    fetch(`/rtc/join/${hostID}`).
      then((response) => response.text()).
      then(connMan.logIn( hostID, username, password, genCHBundle
                        , statusManager.loggingIn, statusManager.iceConnectionLost
                        , onDoorbell, alert, notifyFull, cleanupSession, estabConn));
  };

  estabConn();

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

const loginControls  = new LoginControlsManager(byEID("join-form"), onLogIn);
const previewManager = new       PreviewManager(byEID("session-preview-image"));
const statusManager  = new     AppStatusManager(byEID("status-value"));

document.addEventListener("DOMContentLoaded", () => {

  const onChatBoxHover = () => {
    closedChatBox.classList.remove("brightness-dim-major");
    closedChatBoxBottom.classList.remove("brightness-dim-major");
    closedChatBox.classList.add("brightness-dim-minor");
    closedChatBoxBottom.classList.add("brightness-dim-minor");
  };

  const onChatBoxFocus = () => {
    closedChatBox.classList.remove("brightness-dim-minor");
    closedChatBoxBottom.classList.remove("brightness-dim-minor");
    closedChatBox.classList.add("brightness-dim-major");
    closedChatBoxBottom.classList.add("brightness-dim-major");
  };

  const onChatBoxExit = () => {
    closedChatBox.classList.remove("brightness-dim-minor");
    closedChatBoxBottom.classList.remove("brightness-dim-minor");
    closedChatBox.classList.remove("brightness-dim-major");
    closedChatBoxBottom.classList.remove("brightness-dim-major");
  };

  closedChatBox.onmouseover = onChatBoxHover;
  closedChatBox.onmousedown = onChatBoxFocus;
  closedChatBox.onmouseleave = onChatBoxExit;

  closedChatBoxBottom.onmouseover = onChatBoxHover;
  closedChatBoxBottom.onmousedown = onChatBoxFocus;
  closedChatBoxBottom.onmouseleave = onChatBoxExit;

  closedChatBox.onclick = () => {
    openChatBox.classList.remove("invisible");
    closedChatBox.classList.add("invisible");
    closedChatBoxBottom.classList.add("invisible");

    const globalChatView = !byEID( "global-chat").classList.contains("hidden");

    if (globalChatView) {
      globalChatManager.markAllMessagesRead();
    } else {
      sessionChatManager.markAllMessagesRead();
    }
  };

  openChatHeader.onclick = () => {
    openChatBox.classList.add("invisible");
    closedChatBox.classList.remove("invisible");
    closedChatBoxBottom.classList.remove("invisible");
  };

  const modalContainer = byEID("modal-container");
  const joinBPageMain = byEID("join-b-page");

  const showModal = () => {
    modalContainer.classList.remove("modal-invis");
    joinBPageMain.classList.add("no-select");
  };

  const hideModal = () => {
    modalContainer.classList.add("modal-invis");
    joinBPageMain.classList.remove("no-select");
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

const sessionList =
  new SessionList( byEID("session-list-container"), byEID("session-filter-box")
                 , processURLHash, statusManager, previewManager
                 , loginControls.onNewSelection(() => document.createElement("option")));

const sessionChatManager =
  new ChatManager( byEID("session-chat-output"), byEID("session-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); }
                 , updateSessionChatUnread
                 , updateChatRead);

sessionChatManager.onSend((message) => { connMan.send("chat", { message }); });

const globalChatManager =
  new ChatManager( byEID("global-chat-output"), byEID("global-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); }
                 , updateGlobalChatUnread
                 , updateChatRead);


const connMan    = new ConnectionManager(globalChatManager);
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

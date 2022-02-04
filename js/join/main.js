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

// (String, String) => Unit
const onLogIn = (username, password) => {

  statusManager.connecting();

  // (NEW): Chat box is initially cleared for session chat,
  // so mark all as read (in case messages were previously sent by host)
  sessionChatManager.markAllMessagesRead();

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
  const closedChatBox = byEID("chat-box-closed");
  const closedChatBoxBottom = byEID("chat-box-closed-bottom");
  const openChatBox = byEID("chat-box-open");
  const openChatHeader = byEID("open-chat-header");

  // (NEW): Check for unread messages & update chat box color if needed
  const checkUnreadMessages = () => {
    const globalChatView = !byEID( "global-chat").classList.contains("hidden");
    const sessionChatView = !byEID( "session-chat").classList.contains("hidden");

    if (globalChatView && globalChatManager.hasUnreadMessages()) {
      closedChatBox.classList.remove("chat-box-read");
      closedChatBox.classList.add("chat-box-unread");
      closedChatBoxBottom.classList.remove("chat-box-bottom-read");
      closedChatBoxBottom.classList.add("chat-box-bottom-unread");

      closedChatBox.innerHTML = `Chat: ${globalChatManager.getUnreadMessages().toString()}`
    } else if (sessionChatView && sessionChatManager.hasUnreadMessages()) {
      closedChatBox.classList.remove("chat-box-read");
      closedChatBox.classList.add("chat-box-unread");
      closedChatBoxBottom.classList.remove("chat-box-bottom-read");
      closedChatBoxBottom.classList.add("chat-box-bottom-unread");

      closedChatBox.innerHTML = `Chat: ${sessionChatManager.getUnreadMessages().toString()}`;
    } else {
      closedChatBox.classList.remove("chat-box-unread");
      closedChatBox.classList.add("chat-box-read");
      closedChatBoxBottom.classList.remove("chat-box-bottom-unread");
      closedChatBoxBottom.classList.add("chat-box-bottom-read");

      closedChatBox.innerHTML = "Chat";
    }
  };

  setInterval(checkUnreadMessages, 100);

  // (NEW): Hover / focus styling for new chat box
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
    openChatBox.classList.remove("hidden");
    openChatBox.classList.add("block-display");
    openChatBox.classList.add("chat-fade-in");

    closedChatBox.classList.remove("flex-display");
    closedChatBox.classList.add("hidden");
    closedChatBoxBottom.classList.add("hidden");

    // (NEW): When we open chat box, mark all messages as read
    const globalChatView = !byEID( "global-chat").classList.contains("hidden");

    if (globalChatView) {
      globalChatManager.markAllMessagesRead();
    } else {
      sessionChatManager.markAllMessagesRead();
    }
  };

  openChatHeader.onclick = () => {
    openChatBox.classList.remove("block-display");
    openChatBox.classList.add("hidden");
    openChatBox.classList.remove("chat-fade-in");
    // openChatBox.classList.add("chat-fade-out");

    closedChatBox.classList.remove("hidden");
    closedChatBox.classList.add("flex-display");
    // closedChatBox.classList.remove("chat-fade-out");
    // closedChatBox.classList.add("chat-fade-in");
    closedChatBoxBottom.classList.remove("hidden");
    // closedChatBoxBottom.classList.remove("chat-fade-out");
    // closedChatBoxBottom.classList.add("chat-fade-in");
  };

  // (NEW): Toggle on and off of modal visibility for JoinB page
  const modalContainer = byEID("modal-container");

  window.onclick = (event) => {
    if (event.target === modalContainer) {
      modalContainer.classList.add("hidden");
    }
  };

  byEID("view-details-button").onclick = () => {
    modalContainer.classList.remove("hidden");
  };

  byEID("close-modal-button").onclick = () => {
    modalContainer.classList.add("hidden");
  };

  document.addEventListener("keydown", (event) => {
    if (!modalContainer.classList.contains("hidden") && event.key === "Escape") {
      modalContainer.classList.add("hidden");
    }
  });

  const username = window.localStorage.getItem(usernameLSKey);
  loginControls.setUsername(username || "");
});

const sessionList =
  new SessionList(byEID("session-list-container"), processURLHash, statusManager
                 , previewManager
                 , loginControls.onNewSelection(() => document.createElement("option")));

const sessionChatManager =
  new ChatManager( byEID("session-chat-output"), byEID("session-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); });

sessionChatManager.onSend((message) => { connMan.send("chat", { message }); });

const globalChatManager =
  new ChatManager( byEID("global-chat-output"), byEID("global-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); });

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

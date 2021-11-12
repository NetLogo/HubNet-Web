import { uuidToRTCID    } from "./common.js";
import { galapagos, hnw } from "./domain.js";
import { joinerConfig   } from "./webrtc.js";

import AppStatusManager from "./app-status-manager.js";
import BurstQueue       from "./burst-queue.js";
import ChannelHandler   from "./channel-handler.js";
import RxQueue          from "./rx-queue.js";
import PreviewManager   from "./preview-manager.js";
import SessionList      from "./session-list.js";

import fakeModel from "./fake-model.js";
import genCHB    from "./gen-chan-han-bundle.js";

import * as CompressJS from "./compress.js";

const sendGreeting = CompressJS.sendGreeting(false);
const sendRTC      = CompressJS.sendRTC     (false);

const SigTerm = "signaling-terminated";

self.burstQueue = undefined; // RxQueue
self.rxQueue    = undefined; // BurstQueue

const channels = {}; // Object[Protocol.Channel]

let joinerConnection = new RTCPeerConnection(joinerConfig);

const nlwFrame = // Window
  document.querySelector("#nlw-frame > iframe").contentWindow;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".nlw-iframe").src = `http://${galapagos}/hnw-join`;
});

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

const processURLHash = (seshData) => {

  if (self.location.hash !== "") {
    const trueHash             = self.location.hash.slice(1);
    const [oracleID, username] = trueHash.split(",", 2);
    const match                = document.querySelector(`.session-label[data-uuid="${oracleID}"] > .session-option`);
    if (match !== null) {
      match.click();
      const hasUsername = username !== undefined;
      byEID("username").value =
        hasUsername ? username : prompt("Please enter your login name");
      if (seshData.lookupUnfiltered(oracleID)?.hasPassword) {
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
  const hostID = document.querySelector(".active").dataset.uuid;
  if (channels[hostID] === undefined) {
    channels[hostID] = null;
    connectAndLogin(hostID);
  } else if (channels[hostID] !== null) {
    login(channels[hostID]);
  }
});

// (String) => Unit
const connectAndLogin = (hostID) => {

  fetch(`/rtc/join/${hostID}`).then((response) => response.text()).then(
    (joinerID) => {
      if (joinerID !== "No more hashes") {
        const rtcID   = uuidToRTCID(joinerID);
        const channel = joinerConnection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
        return joinerConnection.createOffer().then(
          (ofr) => {
            // For Safari 15- --Jason B. (11/1/21)
            const isntSafari = ofr instanceof RTCSessionDescription;
            const offer      = isntSafari ? ofr.toJSON() : ofr;
            return [joinerID, channel, offer];
          }
        );
      } else {
        throw new Error("Session is full");
      }
    }
  ).then(
    ([joinerID, channel, offer]) => {

      const signalingW   = new Worker("js/joiner-signaling-socket.js", { type: "module" });
      const signalingURL = `ws://${hnw}/rtc/${hostID}/${joinerID}/join`;
      signalingW.postMessage({ type: "connect", url: signalingURL, offer });

      signalingW.onmessage = ({ data }) => {
        const datum = JSON.parse(data);
        switch (datum.type) {
          case "host-answer": {
            if (joinerConnection.remoteDescription === null) {
              joinerConnection.setRemoteDescription(datum.answer);
            }
            break;
          }
          case "host-ice-candidate": {
            joinerConnection.addIceCandidate(datum.candidate);
            break;
          }
          case "bye-bye": {
            console.warn("Central server disconnected from signaling");
            break;
          }
          case "keep-alive": {
            break;
          }
          default: {
            console.warn(`Unknown signaling message type: ${datum.type}`);
          }
        }
      };

      let knownCandies = new Set([]);

      joinerConnection.onicecandidate =
        ({ candidate }) => {
          if (candidate !== undefined && candidate !== null) {
            const candy    = candidate.toJSON();
            const candyStr = JSON.stringify(candy);
            if (!knownCandies.has(candyStr)) {
              knownCandies = knownCandies.add(candyStr);
              if (signalingW !== SigTerm) {
                signalingW.postMessage({ type: "ice-candidate", candidate: candy });
              }
            }
          }
        };

      joinerConnection.setLocalDescription(offer);

      const notifyFailedInit = () => {
        alert("Sorry.  Something went wrong when trying to load the model.  Please try again.");
        cleanupSession(true, statusManager.failedToLoadModel);
      };

      const bqBundle =
        { loop:              (f) => { requestAnimationFrame(f); }
        , notifyDownloading: statusManager.downloadingModel
        , notifyFailedInit
        };

      self.burstQueue = new BurstQueue(burstBundle, bqBundle);

      const bundleBundle =
        { channel
        , disconnectChannels
        , closeSessionListSocket: sessionList.hibernate
        , enqueue:                self.burstQueue.enqueue
        , notifyLoggedIn:         self.burstQueue.setStateLoggedIn
        , useDefaultPreview:      previewManager.useDefault
        , closeSignaling:         () => { signalingW.terminate(); }
        , getConnectionStats:     () => joinerConnection.getStats()
        , statusManager
        };

      const chanHanBundle = genCHB(bundleBundle);
      const chanHan       = new ChannelHandler(chanHanBundle);
      self.rxQueue        = new RxQueue(chanHan, false);

      channel.onopen = () => {
        statusManager.loggingIn();
        login(channel);
      };

      channel.onclose = (e) => {
        cleanupSession(e.code === 1000);
      };

      channel.onmessage = self.rxQueue.enqueue;

      channels[hostID] = channel;

      requestAnimationFrame(self.burstQueue.run);

      joinerConnection.oniceconnectionstatechange = () => {
        if (joinerConnection.iceConnectionState === "disconnected") {
          cleanupSession(false, statusManager.iceConnectionLost);
        }
      };

    }
  ).catch(
    error => alert(`Cannot join session: ${error.message}`)
  );
};

// (Protocol.Channel) => Unit
const login = (channel) => {
  const username = byEID("username").value;
  const password = byEID("password").value;
  sendGreeting(channel);
  sendRTC(channel)("login", { username, password });
};

// (Boolean, () => Unit) => Unit
const cleanupSession = (warrantsExplanation, updateStatus = () => {}) => {

  joinerConnection = new RTCPeerConnection(joinerConfig);

  self.burstQueue.halt();
  self.rxQueue.reset();

  const formFrame = byEID("session-browser-frame");
  const galaFrame = byEID(            "nlw-frame");
  galaFrame.classList.add(   "hidden");
  formFrame.classList.remove("hidden");
  sessionList.enable();
  postToNLW(fakeModel);
  byEID("join-button").disabled = false;

  if (!warrantsExplanation) {
    alert("Connection to host lost");
  }

  updateStatus();

};

// (String) => Unit
const disconnectChannels = (reason) => {
  Object.entries(channels).forEach(([hostID, channel]) => {
    sendRTC(channel)("bye-bye");
    channel.close(1000, reason);
    delete channels[hostID];
  });
};

// (Object[Any]) => Unit
const postToNLW = (msg) => {
  nlwFrame.postMessage(msg, `http://${galapagos}`);
};

const burstBundle =
  { frame:       nlwFrame
  , getUsername: () => byEID("username").value
  , postToNLW
  , statusManager
  };

// (MessageEvent) => Unit
self.addEventListener("message", (event) => {
  switch (event.data.type) {

    case "relay": {
      const hostID = document.querySelector(".active").dataset.uuid;
      sendRTC(channels[hostID])("relay", event.data);
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
      cleanupSession(true);
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
  disconnectChannels("");
});

self.addEventListener("popstate", (event) => {
  if (event.state !== null && event.state !== undefined) {
    switch (event.state.name) {
      case "joined": {
        joinerConnection = new RTCPeerConnection(joinerConfig);
        cleanupSession(true);
        break;
      }
      default: {
        console.warn(`Unknown state: ${event.state.name}`);
      }
    }
  }
});

byEID("disconnect-button").addEventListener("click", () => {
  disconnectChannels("You disconnected from your last session.  Awaiting new selection.");
});

import { uuidToRTCID    } from "./common.js";
import { galapagos, hnw } from "./domain.js";
import { joinerConfig   } from "./webrtc.js";

import genCHB                from "./gen-chan-han-bundle.js";
import ChannelHandler        from "./channel-handler.js";
import fakeModel             from "./fake-model.js";
import handleBurstMessage    from "./handle-burst-message.js";
import RxQueue               from "./rx-queue.js";
import usePlaceholderPreview from "./use-placeholder-preview.js";

import * as CompressJS from "./compress.js";

const sendGreeting = CompressJS.sendGreeting(false);
const sendRTC      = CompressJS.sendRTC     (false);

const SigTerm = "signaling-terminated";

self.hasCheckedHash = false;

usePlaceholderPreview();

// type Session = { modelName :: String, name :: String, oracleID :: String }

let sessionData = []; // Array[Session]

const channels = {}; // Object[Protocol.Channel]

let joinerConnection = new RTCPeerConnection(joinerConfig);

let pageState   = "uninitialized"; // String
let pageStateTS = -1;              // Number

const messageQueue = []; // Array[Object[Any]]

let loopIsTerminated = false; // Boolean

const nlwFrame = // Window
  document.querySelector("#nlw-frame > iframe").contentWindow;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".nlw-iframe").src = `http://${galapagos}/hnw-join`;
});

// (String) => Unit
const refreshSelection = (oldActiveUUID) => {

  const container = document.getElementById("session-option-container");
  Array.from(container.querySelectorAll(".session-label")).forEach(
    (label) => {
      if (label.querySelector(".session-option").checked) {
        label.classList.add("active");
      } else {
        label.classList.remove("active");
      }
    }
  );

  const activeElem  = document.querySelector(".active");
  const isTarget    = (x) => x.oracleID === activeElem.dataset.uuid;
  const activeEntry = activeElem !== null ? sessionData.find(isTarget) : null;

  const passwordInput    = document.getElementById("password");
  passwordInput.disabled = activeEntry !== null ? !activeEntry.hasPassword : true;

  if (activeElem === null || oldActiveUUID !== activeElem.dataset.uuid) {
    passwordInput.value = "";
  }

  const roleSelect     = document.getElementById("role-select");
  roleSelect.disabled  = activeEntry === null;
  roleSelect.innerHTML = "";

  if (activeEntry !== null) {
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
  document.getElementById("join-button").disabled = activeEntry === null;

};

// (Array[Session]) => Unit
const populateSessionList = (sessions) => {

  const activeElem    = document.querySelector(".active");
  const oldActiveUUID = activeElem !== null ? activeElem.dataset.uuid : null;

  const template = document.getElementById("session-option-template");

  const comparator = (a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  const nodes      = sessions.sort(comparator).map(
    (session) => {

      const numClients = session.roleInfo[0][1];

      const node = template.content.cloneNode(true);

      node.querySelector(".session-name").textContent       = session.name;
      node.querySelector(".session-model-name").textContent = session.modelName;
      node.querySelector(".session-info").textContent       = `${numClients} people`;
      node.querySelector(".session-label").dataset.uuid     = session.oracleID;

      node.querySelector(".session-option").onchange =
        (event) => {
          if (event.target.checked) {
            event.target.parentNode.classList.add("active");
            refreshImage(session.oracleID);
          } else {
            node.querySelector(".session-label").classList.remove("active");
          }
        };

      return node;

    }
  );

  const container = document.getElementById("session-option-container");
  const labels    = Array.from(container.querySelectorAll(".session-label"));
  const selected  = labels.find((label) => label.querySelector(".session-option").checked);

  if (selected !== undefined) {
    const match = nodes.find((node) => node.querySelector(".session-label").dataset.uuid === selected.dataset.uuid);
    if (match !== undefined) {
      match.querySelector(".session-option").checked = true;
      refreshImage(selected.dataset.uuid);
    } else {
      usePlaceholderPreview();
    }
  } else {
    if (sessionData.length > 0) {
      setStatus("Session list received.  Please select a session.");
    } else {
      setStatus("Please wait until someone starts a session, and it will appear in the list below.");
    }
  }

  container.innerHTML = "";
  nodes.forEach((node) => container.appendChild(node));

  refreshSelection(oldActiveUUID);

  if (!self.hasCheckedHash) {
    if (self.location.hash !== "") {
      const trueHash             = self.location.hash.slice(1);
      const [oracleID, username] = trueHash.split(",", 2);
      const match                = document.querySelector(`.session-label[data-uuid="${oracleID}"] > .session-option`);
      if (match !== null) {
        match.click();
        const hasUsername = username !== undefined;
        document.getElementById("username").value =
          hasUsername ? username : prompt("Please enter your login name");
        if (sessionData.find((x) => x.oracleID === oracleID).hasPassword) {
          document.getElementById("password").value =
            prompt("Please enter the room's password");
        }
        document.getElementById("join-button").click();
      }
    }
    self.hasCheckedHash = true;
  }

};

// () => Unit
self.filterSessionList = () => {
  const filterBox = document.getElementById("session-filter-box");
  const term      = filterBox.value.trim().toLowerCase();
  const matches   = (haystack, needle) => haystack.toLowerCase().include(needle);
  const checkIt   = (s) => matches(s.name, term) || matches(s.modelName, term);
  const filtered  = term === "" ? sessionData : sessionData.filter(checkIt);
  populateSessionList(filtered);
};

// () => Unit
self.selectSession = () => {
  const activeElem = document.querySelector(".active");
  refreshSelection(activeElem !== null ? activeElem.dataset.uuid : null);
  setStatus("Session selected.  Please enter a username, enter a password (if needed), and click 'Join'.");
};

// () => Unit
self.join = () => {
  setStatus("Attempting to connect...");
  document.getElementById("join-button").disabled = true;
  const hostID = document.querySelector(".active").dataset.uuid;
  if (channels[hostID] === undefined) {
    channels[hostID] = null;
    connectAndLogin(hostID);
  } else if (channels[hostID] !== null) {
    login(channels[hostID]);
  }
};

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

      const slsw = serverListSocketW;

      const bundleBundle =
        { channel
        , disconnectChannels
        , closeSignaling:        ()  => { signalingW.terminate(); }
        , closeServerListSocket: ()  => { slsw.postMessage({ type: "hibernate" }); }
        , enqueue:               (x) => messageQueue.push(x)
        , getConnectionStats:    ()  => joinerConnection.getStats()
        , notifyLoggedIn:        ()  => { setPageState("logged in"); }
        , setStatus
        };

      const chanHanBundle = genCHB(bundleBundle);
      const chanHan       = new ChannelHandler(chanHanBundle);
      self.rxQueue        = new RxQueue(chanHan, false);

      channel.onopen = () => {
        setStatus("Connected!  Attempting to log in....");
        login(channel);
      };

      channel.onclose = (e) => {
        cleanupSession(e.code === 1000, e.reason);
      };

      channel.onmessage = self.rxQueue.enqueue;

      channels[hostID] = channel;

      loopIsTerminated = false;
      requestAnimationFrame(processQueue);

      joinerConnection.oniceconnectionstatechange = () => {
        if (joinerConnection.iceConnectionState === "disconnected") {
          cleanupSession();
        }
      };

    }
  ).catch(
    error => alert(`Cannot join session: ${error.message}`)
  );
};

const serverListSocketW = new Worker("js/server-list-socket.js", { type: "module" });
serverListSocketW.postMessage({ type: "connect" });
serverListSocketW.onmessage = ({ data }) => {
  sessionData = JSON.parse(data);
  self.filterSessionList();
};

// (Protocol.Channel) => Unit
const login = (channel) => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  sendGreeting(channel);
  sendRTC(channel)("login", { username, password });
};

// () => Unit
const processQueue = () => {

  if (pageState === "logged in") {
    if (pageStateTS + 60000 >= (new Date).getTime()) {
      let   stillGoing = true;
      const deferred   = [];
      while (stillGoing && messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message.type === "initial-model") {
          setStatus("Downloading model from host...");
          handleBurstMessage(burstBundle)(message);
          stillGoing = false;
        } else {
          deferred.push(message);
        }
      }
      deferred.forEach((d) => messageQueue.push(d));
    } else {
      alert("Sorry.  Something went wrong when trying to load the model.  Please try again.");
      cleanupSession(true, "NetLogo Web failed to load the host's model.  Try again.");
    }
  } else if (pageState === "booted up") {
    while (messageQueue.length > 0) {
      const message = messageQueue.shift();
      handleBurstMessage(burstBundle)(message);
    }
  } else {
    console.log("Skipping while in state:", pageState);
  }

  if (!loopIsTerminated) {
    requestAnimationFrame(processQueue);
  }

};

// (String) => Unit
const refreshImage = (oracleID) => {
  const image = document.getElementById("session-preview-image");
  fetch(`/preview/${oracleID}`).then((response) => {
    if (response.ok) {
      response.text().then((base64) => { image.src = base64; });
    } else {
      usePlaceholderPreview();
    }
  }).catch(() => { usePlaceholderPreview(); });
};

// (Boolean, String) => Unit
const cleanupSession = (wasExpected, statusText) => {

  loopIsTerminated = true;

  joinerConnection = new RTCPeerConnection(joinerConfig);

  self.rxQueue.reset();

  setPageState("uninitialized");
  const formFrame = document.getElementById("server-browser-frame");
  const galaFrame = document.getElementById(           "nlw-frame");
  galaFrame.classList.add(   "hidden");
  formFrame.classList.remove("hidden");
  serverListSocketW.postMessage({ type: "connect" });
  postToNLW(fakeModel);
  document.getElementById("join-button").disabled = false;

  if (!wasExpected) {
    alert("Connection to host lost");
  }

  if (statusText !== undefined) {
    setStatus(statusText);
  }

};

// (String) => Unit
const setStatus = (statusText) => {
  document.getElementById("status-value").innerText = statusText;
};

// (String) => Unit
const setPageState = (state) => {
  pageState   = state;
  pageStateTS = (new Date).getTime();
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
  { frame:          nlwFrame
  , getUsername:    () => document.getElementById("username").value
  , notifyBootedUp: () => setPageState("booted up")
  , postToNLW
  , setStatus
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
      setStatus("You encountered an error and your session had to be closed.  Sorry about that.  Maybe your next session will treat you better.");
      cleanupSession(true, undefined);
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
        cleanupSession(true, undefined);
        break;
      }
      default: {
        console.warn(`Unknown state: ${event.state.name}`);
      }
    }
  }
});

document.getElementById("disconnect-button").addEventListener("click", () => {
  disconnectChannels("You disconnected from your last session.  Awaiting new selection.");
});

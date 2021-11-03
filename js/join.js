import * as ConvertersCommonJS from "./protobuf/converters-common.js";

const decodeInput = ConvertersCommonJS.decodePBuf(false);

import { HNWProtocolVersionNumber, typeIsOOB, uuidToRTCID } from "./common.js";
import { MinID, prevID, SentinelID, succeedsID } from "./id-manager.js";
import { joinerConfig } from "./webrtc.js";

import * as CompressJS from "./compress.js";

const sendGreeting = CompressJS.sendGreeting(false);
const sendRTC      = CompressJS.sendRTC     (false);

const SigTerm = "signaling-terminated";

self.hasCheckedHash = false;

const placeholderBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";

// () => Unit
const usePlaceholderPreview = () => {
  document.getElementById("session-preview-image").src = placeholderBase64;
};

usePlaceholderPreview();

// type Session = { modelName :: String, name :: String, oracleID :: String }
let sessionData = []; // Array[Session]

const channels = {};   // Object[Protocol.Channel]

let joinerConnection = new RTCPeerConnection(joinerConfig);

let pageState   = "uninitialized";
let pageStateTS = -1;

const messageQueue = []; // Array[Object[Any]]

const waitingForBabby = {}; // Object[Any]

let loopIsTerminated = false; // Boolean

let recentPings = []; // Array[Number]

const dummyID = 0; // Number

let lastMsgID   = dummyID; // Number
let predIDToMsg = {};      // Object[UUID, Any]

const multiparts       = {}; // Object[UUID, String]
const multipartHeaders = {}; // Object[UUID, String]

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
  const activeEntry = activeElem !== null ? sessionData.find((x) => x.oracleID === activeElem.dataset.uuid) : null;

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

  // Better criteria later (especially the # of slots open in session) --JAB (6/12/19)
  document.getElementById("join-button").disabled = activeEntry === null;

};

// (Array[Session]) => Unit
const populateSessionList = (sessions) => {

  const activeElem    = document.querySelector(".active");
  const oldActiveUUID = activeElem !== null ? activeElem.dataset.uuid : null;

  const template = document.getElementById("session-option-template");

  const nodes = sessions.sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1).map(
    (session) => {

      const node = template.content.cloneNode(true);
      node.querySelector(".session-name").textContent       = session.name;
      node.querySelector(".session-model-name").textContent = session.modelName;
      node.querySelector(".session-info").textContent       = `${session.roleInfo[0][1]} people`;
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
        document.getElementById("username").value = username !== undefined ? username : prompt("Please enter your login name");
        if (sessionData.find((x) => x.oracleID === oracleID).hasPassword) {
          document.getElementById("password").value = prompt("Please enter the room's password");
        }
        document.getElementById("join-button").click();
      }
    }
    self.hasCheckedHash = true;
  }

};

// () => Unit
self.filterSessionList = () => {
  const term     = document.getElementById("session-filter-box").value.trim().toLowerCase();
  const checkIt  = ({ name, modelName }) => name.toLowerCase().includes(term) || modelName.toLowerCase().includes(term);
  const filtered = term === "" ? sessionData : sessionData.filter(checkIt);
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
            const offer = (ofr instanceof RTCSessionDescription) ? ofr.toJSON() : ofr;
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
      const signalingURL = `ws://localhost:8080/rtc/${hostID}/${joinerID}/join`;
      signalingW.postMessage({ type: "connect", url: signalingURL, offer });

      const closeSignaling = () => signalingW.terminate();

      signalingW.onmessage = ({ data }) => {
        const datum = JSON.parse(data);
        switch (datum.type) {
          case "host-answer":
            if (joinerConnection.remoteDescription === null) {
              joinerConnection.setRemoteDescription(datum.answer);
            }
            break;
          case "host-ice-candidate":
            joinerConnection.addIceCandidate(datum.candidate);
            break;
          case "bye-bye":
            console.warn("Central server disconnected from signaling");
            break;
          case "keep-alive":
            break;
          default:
            console.warn(`Unknown signaling message type: ${datum.type}`);
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

      channel.onopen    = () => { setStatus("Connected!  Attempting to log in...."); login(channel); };
      channel.onmessage = handleChannelMessages(channel, closeSignaling);
      channel.onclose   = (e) => { cleanupSession(e.code === 1000, e.reason); };
      channels[hostID]  = channel;

      loopIsTerminated = false; // Boolean
      requestAnimationFrame(processQueue);

      joinerConnection.oniceconnectionstatechange = () => {
        if (joinerConnection.iceConnectionState == "disconnected") {
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
  filterSessionList();
};

// (Protocol.Channel) => Unit
const login = (channel) => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  sendGreeting(channel);
  sendRTC(channel)("login", { username, password });
};

// (Protocol.Channel, () => Unit) => (Any) => Unit
const handleChannelMessages = (channel, closeSignaling) => ({ data }) => {

  const dataArr = new Uint8Array(data);
  const datum   = decodeInput(dataArr);

  if (datum.type !== "keep-alive" && datum.type !== "ping" && datum.type !== "pong") {
    console.log("Decoded: ", datum);
  }

  if (typeIsOOB(datum.type)) {
    processChannelMessage(channel, closeSignaling, datum);
  } else {

    const processMsgQueue = () => {
      const successor = predIDToMsg[lastMsgID];
      if (successor !== undefined) {
        delete predIDToMsg[lastMsgID];
        lastMsgID = successor.id;
        processChannelMessage(channel, closeSignaling, successor);
        processMsgQueue();
      }
    };

    const processIt = (msg) => {
      if (msg.id === SentinelID) {
        processChannelMessage(channel, closeSignaling, msg);
      } else if (msg.id === MinID) {
        lastMsgID = msg.id;
        processChannelMessage(channel, closeSignaling, msg);
      } else {
        if (succeedsID(msg.id, lastMsgID)) {
          const pred = prevID(msg.id);
          predIDToMsg[pred] = msg;
          processMsgQueue();
        } else {
          console.warn(`Received message #${msg.id} when the last-processed message was #${lastMsgID}.  #${msg.id} is out-of-order and will be dropped:`, msg);
        }
      }
    };

    const assembleBucket = (bucket) => {

      const totalLength = bucket.reduce((acc, x) => acc + x.length, 0);
      const arr         = new Uint8Array(totalLength);

      bucket.reduce((acc, x) => { arr.set(x, acc); return acc + x.length; }, 0);

      return arr;

    };

    if (datum.fullLength === 1) {
      const parcel  = decodeInput(datum.parcel);
      const header  = { type: datum.type, id: datum.id };
      const fullMsg = Object.assign({}, header, { parcel });
      processIt(fullMsg);
    } else if ((datum.fullLength || 1) !== 1) {

      const { id, index, fullLength, parcel } = datum;

      if (fullLength > 1) {
        console.log(`Got ${id} (${(index + 1)}/${fullLength})`);
      }

      if (multiparts[id] === undefined) {
        multiparts[id] = Array(fullLength).fill(null);
      }

      if (index === 0) {
        multipartHeaders[id] = { type: datum.type, id };
      }

      const bucket = multiparts[id];
      bucket[index] = parcel;

      if (bucket.every((x) => x !== null)) {

        const parcel  = decodeInput(assembleBucket(bucket));
        const header  = multipartHeaders[id];
        const fullMsg = Object.assign({}, header, { parcel });

        delete multiparts[id];
        delete multipartHeaders[id];

        processIt(fullMsg);

      }

    } else {
      processIt(datum);
    }

  }

};

// (Protocol.Channel, () => Unit, Object[Any]) => Unit
const processChannelMessage = (channel, closeSignaling, datum) => {

  switch (datum.type) {

    case "connection-established":

      if (datum.protocolVersion !== HNWProtocolVersionNumber) {
        alert(`HubNet protocol version mismatch!  You are using protocol version '${HNWProtocolVersionNumber}', while the host is using version '${datum.protocolVersion}'.  To ensure that you and the host are using the same version of HubNet Web, all parties should clear their browser cache and try connecting again.  Your connection will now close.`);
        disconnectChannels("Protocol version number mismatch");
      }

      joinerConnection.getStats().then(
        (stats) => {

          const usesTURN =
            Array.from(stats.values()).some(
              (v) =>
                v.type === "candidate-pair" &&
                  v.state === "succeeded" &&
                  v.localCandidateId &&
                  stats.get(v.localCandidateId).candidateType === "relay"
            );

          const desc = usesTURN ? "Server-based" : "Peer-to-Peer";

          document.getElementById("connection-type-span").innerText = desc;

        }
      );

      break;

    case "login-successful":
      closeSignaling();
      setStatus("Logged in!  Loading NetLogo and then asking for model....");
      serverListSocketW.postMessage({ type: "hibernate" });
      switchToNLW();
      break;

    case "incorrect-password":
      setStatus("Login rejected!  Use correct password.");
      alert("Incorrect password");
      document.getElementById("join-button").disabled = false;
      break;

    case "no-username-given":
      setStatus("Login rejected!  Please provide a username.");
      alert("You must provide a username.");
      document.getElementById("join-button").disabled = false;
      break;

    case "username-already-taken":
      setStatus("Login rejected!  Choose a unique username.");
      alert("Username already in use.");
      document.getElementById("join-button").disabled = false;
      break;

    case "ping":

      const { id, lastPing } = datum;

      sendRTC(channel)("pong", { id });

      if (lastPing !== undefined) {

        recentPings.push(lastPing);

        if (recentPings.length > 5) {
          recentPings.shift();
        }

        const averagePing = Math.round(recentPings.reduce((x, y) => x + y) / recentPings.length);
        document.getElementById("latency-span").innerText = averagePing;

      }

      break;

    case "hnw-burst":
      enqueueMessage(datum.parcel);
      break;

    case "bye-bye":
      channel.close(1000, "The host disconnected.  Awaiting new selection.");
      alert("The host disconnected from the activity");

    case "keep-alive":
      break;

    default:
      console.warn(`Unknown channel event type: ${datum.type}`);

  }

};

// (Object[Any]) => Unit
const enqueueMessage = (datum) => {
  messageQueue.push(datum);
};

// () => Unit
const processQueue = () => {

  if (pageState === "logged in") {
    if (pageStateTS + 60000 >= (new Date).getTime()) {
      let   stillGoing = true;
      const deferred   = [];
      while (stillGoing && messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message.type ===  "initial-model") {
          setStatus("Downloading model from host...");
          handleBurstMessage(message);
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
      handleBurstMessage(message);
    }
  } else {
    console.log("Skipping while in state:", pageState);
  }

  if (!loopIsTerminated) {
    requestAnimationFrame(processQueue);
  }

};

// (Object[Any]) => Unit
const handleBurstMessage = (datum) => {

  switch (datum.type) {

    case "initial-model":

      setStatus("Model and world acquired!  Waiting for NetLogo Web to be ready...");

      const username = document.getElementById("username").value;

      const intervalID = setInterval(
        () => {
          document.querySelector("#nlw-frame > iframe").contentWindow.postMessage({
            type: "hnw-are-you-ready-for-interface" }
          , "*");
        }
      , 1000);

      waitingForBabby["yes-i-am-ready-for-interface"] = {
        forPosting: {
          type:  "hnw-load-interface"
        , username
        , role:  datum.role
        , token: datum.token
        , view:  datum.view
        }
      , forFollowup: "hnw-are-you-ready-for-state"
      , forCancel:   intervalID
      };

      waitingForBabby["interface-loaded"] = {
        forPosting: {
          type:   "nlw-state-update"
        , update: datum.state
        }
      };

      break;

    case "state-update":
      document.querySelector("#nlw-frame > iframe").contentWindow.postMessage({
        update: datum.update,
        type:   "nlw-apply-update"
      }, "*");
      break;

    case "relay":
      document.querySelector("#nlw-frame > iframe").contentWindow.postMessage(datum.payload, "*");
      break;

    case "hnw-resize":
      break;

    default:
      console.warn(`Unknown bursted sub-event type: ${datum.type}`);

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

// () => Unit
const loadFakeModel = () => {

  const fakeDimensions =
    { minPxcor:           0
    , maxPxcor:           0
    , minPycor:           0
    , maxPycor:           0
    , patchSize:          1
    , wrappingAllowedInX: true
    , wrappingAllowedInY: true
    };

  const fakeView =
    { bottom:           0
    , compilation:      { success: true, messages: [] }
    , dimensions:       fakeDimensions
    , fontSize:         10
    , frameRate:        30
    , id:               0
    , left:             0
    , right:            0
    , showTickCounter:  true
    , tickCounterLabel: "ticks"
    , top:              0
    , type:             "view"
    , updateMode:       "TickBased"
    };

  const fakeRole =
    { canJoinMidRun: true
    , isSpectator:   true
    , limit:         -1
    , name:          "fake role"
    , onConnect:     ""
    , onCursorClick: null
    , onCursorMove:  null
    , onDisconnect:  ""
    , widgets:       [fakeView]
    };

  const fakePayload =
    { role:     fakeRole
    , token:    "invalid token"
    , type:     "hnw-load-interface"
    , username: "no username"
    , view:     fakeView
    };

  document.getElementById("nlw-frame").querySelector("iframe").contentWindow.postMessage(fakePayload, "*");

};

// (Boolean, String) => Unit
const cleanupSession = (wasExpected, statusText) => {

  loopIsTerminated = true;

  joinerConnection = new RTCPeerConnection(joinerConfig);
  recentPings      = [];
  lastMsgID        = dummyID;
  predIDToMsg      = {};

  setPageState("uninitialized");
  const formFrame = document.getElementById("server-browser-frame");
  const  nlwFrame = document.getElementById(           "nlw-frame");
  nlwFrame .classList.add(   "hidden");
  formFrame.classList.remove("hidden");
  serverListSocketW.postMessage({ type: "connect" });
  loadFakeModel();
  document.getElementById("join-button").disabled = false;

  if (!wasExpected) {
    alert("Connection to host lost");
  }

  if (statusText !== undefined) {
    setStatus(statusText);
  }

};

// () => Unit
const switchToNLW = () => {

  document.querySelector(".session-option").checked = false;
  usePlaceholderPreview();

  const formFrame = document.getElementById("server-browser-frame");
  const  nlwFrame = document.getElementById(           "nlw-frame");
  formFrame.classList.add(   "hidden");
  nlwFrame .classList.remove("hidden");

  history.pushState({ name: "joined" }, "joined");
  setPageState("logged in");

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

self.addEventListener("message", (event) => {
  switch (event.data.type) {

    case "relay":
      if (event.data.payload.type === "interface-loaded") {
        setStatus("Model loaded and ready for you to use!");
        const stateEntry = waitingForBabby[event.data.payload.type];
        if (stateEntry !== undefined) {
          delete waitingForBabby[event.data.payload.type];
          document.querySelector("#nlw-frame > iframe").contentWindow.postMessage(stateEntry.forPosting, "*");
        }
        setPageState("booted up");
      } else {
        const hostID = document.querySelector(".active").dataset.uuid;
        sendRTC(channels[hostID])("relay", event.data);
      }
      break;

    case "hnw-fatal-error":
      switch (event.data.subtype) {
        case "unknown-agent":
          alert(`We received an update for an agent that we have never heard of (${event.data.agentType} #${event.data.agentID}).\n\nIn a later version, we will add the ability to resynchronize with the server to get around this issue.  However, the only solution right now is for the activity to close.\n\nYou might have better success if you reconnect.`);
          break;
        default:
          alert(`An unknown fatal error has occurred: ${event.data.subtype}`);
      }
      setStatus("You encountered an error and your session had to be closed.  Sorry about that.  Maybe your next session will treat you better.");
      cleanupSession(true, undefined);
      break;

    case "yes-i-am-ready-for-interface":
      setStatus("Loading up interface in NetLogo Web...");
      const uiEntry = waitingForBabby[event.data.type];
      delete waitingForBabby[event.data.type];
      document.querySelector("#nlw-frame > iframe").contentWindow.postMessage(uiEntry.forPosting , "*");
      document.querySelector("#nlw-frame > iframe").contentWindow.postMessage(uiEntry.forFollowup, "*");
      clearInterval(uiEntry.forCancel);
      break;

    case "hnw-resize":
      break;

    default:
      console.warn(`Unknown message type: ${event.data.type}`);

  }
});

self.addEventListener("beforeunload", (event) => {
  // Honestly, this will probably not run before the tab closes.  Not much I can do about that.  --JAB (8/21/20)
  disconnectChannels("");
});

self.addEventListener("popstate", (event) => {
  if (event.state !== null && event.state !== undefined) {
    switch (event.state.name) {
      case "joined":
        joinerConnection = new RTCPeerConnection(joinerConfig);
        cleanupSession(true, undefined);
      default:
        console.warn(`Unknown state: ${event.state.name}`);
    }
  }
});

document.getElementById("disconnect-button").addEventListener("click", () => {
  disconnectChannels("You disconnected from your last session.  Awaiting new selection.");
});

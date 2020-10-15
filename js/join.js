window.hasCheckedHash = false;

const placeholderBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";

// () => Unit
const usePlaceholderPreview = () => {
  document.getElementById('session-preview-image').src = placeholderBase64;
};

usePlaceholderPreview();

// type Session = { modelName :: String, name :: String, oracleID :: String }
let sessionData = []; // Array[Session]

let channels = {}; // Object[WebSocket]

let pageState   = "uninitialized";
let pageStateTS = -1;

let messageQueue = []; // Array[Object[Any]]

let waitingForBabby = {}; // Object[Any]

let mainEventLoopID = null; // Number

let recentPings = []; // Array[Number]

let lastMsgID   = '00000000-0000-0000-0000-000000000000'; // UUID
let predIDToMsg = {};                                     // Object[UUID, Any]

const multiparts       = {}; // Object[UUID, String]
const multipartHeaders = {}; // Object[UUID, String]

// (String) => Unit
const refreshSelection = (oldActiveUUID) => {

  const container = document.getElementById('session-option-container');
  Array.from(container.querySelectorAll('.session-label')).forEach(
    (label) => {
      if (label.querySelector('.session-option').checked) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    }
  );

  const activeElem  = document.querySelector('.active');
  const activeEntry = activeElem !== null ? sessionData.find((x) => x.oracleID === activeElem.dataset.uuid) : null;

  const passwordInput    = document.getElementById('password');
  passwordInput.disabled = activeEntry !== null ? !activeEntry.hasPassword : true;

  if (activeElem === null || oldActiveUUID !== activeElem.dataset.uuid) {
    passwordInput.value = '';
  }

  const roleSelect     = document.getElementById('role-select');
  roleSelect.disabled  = activeEntry === null;
  roleSelect.innerHTML = '';

  if (activeEntry !== null) {
    activeEntry.roleInfo.forEach(
      ([roleName, current, max]) => {
        const node        = document.createElement('option');
        const isUnlimited = max === 0;
        node.disabled     = !isUnlimited && current >= max;
        node.innerText    = isUnlimited ? `${roleName} | ${current}` : `${roleName} | ${current}/${max}`;
        node.value        = roleName;
        roleSelect.appendChild(node);
      }
    );
  }

  // Better criteria later (especially the # of slots open in session) --JAB (6/12/19)
  document.getElementById('join-button').disabled = activeEntry === null;

};

// (Array[Session]) => Unit
const populateSessionList = (sessions) => {

  const activeElem    = document.querySelector('.active');
  const oldActiveUUID = activeElem !== null ? activeElem.dataset.uuid : null;

  const template = document.getElementById('session-option-template');

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

  const container = document.getElementById('session-option-container');
  const labels    = Array.from(container.querySelectorAll('.session-label'));
  const selected  = labels.find((label) => label.querySelector('.session-option').checked);

  if (selected !== undefined) {
    const match = nodes.find((node) => node.querySelector('.session-label').dataset.uuid === selected.dataset.uuid)
    if (match !== undefined) {
      match.querySelector('.session-option').checked = true;
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

  if (!window.hasCheckedHash) {
    if (window.location.hash !== "") {
      const oracleID = window.location.hash.slice(1);
      const match    = document.querySelector(`.session-label[data-uuid='${oracleID}'] > .session-option`);
      if (match !== null) {
        match.click();
        document.getElementById('username').value = prompt("Please enter your login name");
        if (sessionData.find((x) => x.oracleID === oracleID).hasPassword) {
          document.getElementById('password').value = prompt("Please enter the room's password");
        }
        document.getElementById('join-button').click();
      }
    }
    window.hasCheckedHash = true;
  }

};

// () => Unit
window.filterSessionList = () => {
  const term     = document.getElementById('session-filter-box').value.trim().toLowerCase();
  const checkIt  = ({ name, modelName }) => name.toLowerCase().includes(term) || modelName.toLowerCase().includes(term);
  const filtered = term === '' ? sessionData : sessionData.filter(checkIt);
  populateSessionList(filtered);
};

// () => Unit
window.selectSession = () => {
  const activeElem = document.querySelector('.active');
  refreshSelection(activeElem !== null ? activeElem.dataset.uuid : null);
  setStatus("Session selected.  Please enter a username, enter a password (if needed), and click 'Join'.");
};

// () => Unit
window.join = () => {
  setStatus("Attempting to connect...");
  document.getElementById('join-button').disabled = true;
  const hostID = document.querySelector('.active').dataset.uuid;
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
      const rtcID   = uuidToRTCID(joinerID);
      const channel = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${joinerID}/join`);
      channel.onopen    = () => { setStatus("Connected!  Attempting to log in...."); login(channel); }
      channel.onmessage = handleChannelMessages(channel);
      channel.onclose   = (e) => { cleanupSession(e.code === 1000, e.reason); }
      channels[hostID] = channel;
      mainEventLoopID  = setInterval(processQueue, 1000 / 30);
  });

};

// () => WebSocket
const openListSocket = () => {
  const socket = new WebSocket(`ws://localhost:8080/hnw/session-stream`);
  socket.addEventListener('message', ({ data }) => {
    sessionData = JSON.parse(data);
    filterSessionList();
  });
  return socket;
};

let serverListSocket = openListSocket();

// (RTCDataChannel) => Unit
const login = (channel) => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  sendGreeting(channel);
  sendObj(channel)("login", { username, password });
};

// (RTCDataChannel) => (Any) => Unit
const handleChannelMessages = (channel) => ({ data }) => {

  const datum = JSON.parse(data);

  if (datum.isOutOfBand === true) {
    processChannelMessage(channel, datum);
  } else {

    const processMsgQueue = () => {
      const successor = predIDToMsg[lastMsgID]
      if (successor !== undefined) {
        delete predIDToMsg[lastMsgID];
        lastMsgID = successor.id
        processChannelMessage(channel, successor);
        processMsgQueue();
      }
    };

    if ((datum.fullLength || 1) !== 1) {

      const { id, index, fullLength, parcel } = datum

      if (fullLength > 1) {
        console.log("Got " + id + " (" + (index + 1) + "/" + fullLength + ")")
      }

      if (multiparts[id] === undefined) {
        multiparts[id] = Array(fullLength).fill(null);
      }

      if (index === 0) {
        multipartHeaders[id] = { type: datum.type, id, predecessorID: datum.predecessorID }
      }

      const bucket = multiparts[id];
      bucket[index] = parcel;

      if (fullLength > 100) {
        const valids = multiparts[id].filter((x) => x !== null);
        if (multiparts[id][0].startsWith("\"{\\\"type\\\":\\\"here-have-a-model\\\"")) {
          setStatus(`Downloading model from host... (${valids.length}/${fullLength})`);
        }
      }

      if (bucket.every((x) => x !== null)) {

        const fullText   = multiparts[id].join("");
        const header     = multipartHeaders[id]
        const fullMsg    = Object.assign({}, header, { parcel: fullText });

        delete multiparts[id];
        delete multipartHeaders[id];

        predIDToMsg[fullMsg.predecessorID] = fullMsg;
        processMsgQueue();

      }

    } else {
      predIDToMsg[datum.predecessorID] = datum;
      processMsgQueue();
    }

  }

};

// (RTCDataChannel, datum) => Unit
const processChannelMessage = (channel, datum) => {

  switch (datum.type) {

    case "connection-established":
      break;

    case "login-successful":
      setStatus("Logged in!  Loading NetLogo and then asking for model....")
      serverListSocket.close(1000, "Server list is not currently needed");
      switchToNLW();
      break;

    case "incorrect-password":
      setStatus("Login rejected!  Use correct password.")
      alert("Bad password, pal—real bad!");
      document.getElementById('join-button').disabled = false;
      break;

    case "no-username-given":
      setStatus("Login rejected!  The server did not receive a username from you.")
      alert("No username given!");
      document.getElementById('join-button').disabled = false;
      break;

    case "username-already-taken":
      setStatus("Login rejected!  Use a unique username.")
      alert("Username already in use!");
      document.getElementById('join-button').disabled = false;
      break;

    case "ping":
      sendObj(channel)("pong", { id: datum.id }, true);
      break;

    case "ping-result":

      recentPings.push(datum.time);
      if (recentPings.length > 5) {
        recentPings.shift();
      };

      const averagePing = Math.round(recentPings.reduce((x, y) => x + y) / recentPings.length);
      document.getElementById("latency-span").innerText = averagePing;

      break;

    case "rtc-burst":
      enqueueMessage(JSON.parse(decompress(datum.parcel)));
      break;

    case "bye-bye":
      channel.close(1000, "The host disconnected.  Awaiting new selection.");
      alert("The host disconnected from the activity");

    case "keep-alive":
      break;

    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);

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
      let stillGoing = true;
      let deferred   = [];
      while (stillGoing && messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message.type ===  "here-have-a-model") {
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

};

// (Object[Any]) => Unit
const handleBurstMessage = (datum) => {

  switch (datum.type) {

    case "here-have-a-model":

      setStatus("Model and world acquired!  Waiting for NetLogo Web to be ready...");

      const username = document.getElementById('username').value;

      const intervalID = setInterval(
        () => {
          document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
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

    case "here-have-an-update":
      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
        update: datum.update,
        type:   "nlw-apply-update"
      }, "*");
      break;

    case "relay":
      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage(datum.payload, "*");
      break;

    case "hnw-resize":
      break;

    default:
      console.warn(`Unknown bursted sub-event type: ${datum.type}`);

  }

};

// (String) => Unit
const refreshImage = (oracleID) => {
  const image = document.getElementById('session-preview-image');
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

  clearInterval(mainEventLoopID);

  lastMsgID   = '00000000-0000-0000-0000-000000000000';
  predIDToMsg = {};

  setPageState("uninitialized");
  const formFrame = document.getElementById("server-browser-frame");
  const  nlwFrame = document.getElementById(           "nlw-frame");
  nlwFrame .classList.add(   "hidden");
  formFrame.classList.remove("hidden");
  serverListSocket = openListSocket();
  loadFakeModel();
  document.getElementById('join-button').disabled = false;

  if (!wasExpected) {
    alert("Connection to host lost");
  }

  if (statusText !== undefined) {
    setStatus(statusText);
  }

};

// () => Unit
const switchToNLW = () => {

  document.querySelector('.session-option').checked = false;
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
  document.getElementById('status-value').innerText = statusText;
};

// (String) => Unit
const setPageState = (state) => {
  pageState   = state;
  pageStateTS = (new Date).getTime();
};

// (String) => Unit
const disconnectChannels = (reason) => {
  Object.entries(channels).forEach(([hostID, channel]) => {
    sendObj(channel)("bye-bye");
    channel.close(1000, reason);
    delete channels[hostID];
  });
};

window.addEventListener('message', (event) => {
  switch (event.data.type) {

    case "relay":
      if (event.data.payload.type === "interface-loaded") {
        setStatus("Model loaded and ready for you to use!");
        let stateEntry = waitingForBabby[event.data.payload.type];
        if (stateEntry !== undefined) {
          delete waitingForBabby[event.data.payload.type];
          document.querySelector('#nlw-frame > iframe').contentWindow.postMessage(stateEntry.forPosting, "*");
        }
        setPageState("booted up");
      } else {
        const hostID = document.querySelector('.active').dataset.uuid;
        sendObj(channels[hostID])("relay", event.data);
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
      let uiEntry = waitingForBabby[event.data.type];
      delete waitingForBabby[event.data.type];
      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage(uiEntry.forPosting , "*");
      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage(uiEntry.forFollowup, "*");
      clearInterval(uiEntry.forCancel);
      break;

    case "hnw-resize":
      break;

    default:
      console.warn(`Unknown message type: ${event.data.type}`);

  }
});

window.addEventListener("beforeunload", (event) => {
  // Honestly, this will probably not run before the tab closes.  Not much I can do about that.  --JAB (8/21/20)
  disconnectChannels("");
});

window.addEventListener('popstate', (event) => {
  if (event.state !== null && event.state !== undefined) {
    switch (event.state.name) {
      case "joined":
        cleanupSession(true, undefined);
      default:
        console.warn(`Unknown state: ${event.state.name}`);
    }
  }
});

document.getElementById("disconnect-button").addEventListener("click", () => {
  disconnectChannels("You disconnected from your last session.  Awaiting new selection.");
});

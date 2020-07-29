window.hasCheckedHash = false;

const placeholderB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";
document.getElementById('session-preview-image').src = placeholderB64;

// type Session = { modelName :: String, name :: String, oracleID :: String }
let sessionData = []; // Array[Session]

let channels = {}; // Object[WebSocket]

let pageState = "uninitialized";

let messageQueue = []; // Array[Object[Any]]

const rtcBursts = {} // Object[String]

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
      document.getElementById('session-preview-image').src = placeholderB64;
    }
  }

  container.innerHTML = "";
  nodes.forEach((node) => container.appendChild(node));

  refreshSelection(oldActiveUUID);

  if (!window.hasCheckedHash) {
    setStatus("Session list received.  Please select a session.");
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
      channel.onclose   = () => { setStatus("Session closed.  Awaiting new selection."); cleanupSession(); }
      channels[hostID] = channel;
      setInterval(processQueue, 1000 / 30);
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

let serverListSocket = openListSocket(`ws://localhost:8080/hnw/session-stream`);

// (RTCDataChannel) => Unit
const login = (channel) => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  sendObj(channel)("login", { username, password });
}

// (RTCDataChannel) => (Any) => Unit
const handleChannelMessages = (channel) => ({ data }) => {

  const datum = JSON.parse(data);

  switch (datum.type) {

    case "login-successful":
      setStatus("Logged in!  Loading NetLogo and then asking for model....")
      serverListSocket.close();
      switchToNLW();
      break;

    case "incorrect-password":
      setStatus("Login rejected!  Use correct password.")
      alert("Bad password, pal—real bad!");
      break;

    case "username-already-taken":
      setStatus("Login rejected!  Use a unique username.")
      alert("Username already in use!");
      break;

    case "rtc-burst":

      const { id, index, fullLength, parcel } = datum

      if (fullLength > 1) {
        console.log("Got " + id + " (" + (index + 1) + "/" + fullLength + ")")
      }

      if (rtcBursts[id] === undefined) {
        rtcBursts[id] = Array(fullLength).fill(null);
      }

      const bucket = rtcBursts[id];
      bucket[index] = parcel;

      if (fullLength > 100) {
        const valids = rtcBursts[id].filter((x) => x !== null);
        setStatus(`Downloading model from host... (${valids.length}/${fullLength})`);
      }

      if (bucket.every((x) => x !== null)) {
        const fullMessage = rtcBursts[id].join("");
        const object      = JSON.parse(decompress(fullMessage));
        delete rtcBursts[id];
        enqueueMessage(object);
      }

      break;

    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);

  }

};

// (Object[Any]) => Unit
const enqueueMessage = (datum) => {
  messageQueue.push(datum);
}

// () => Unit
const processQueue = () => {

  if (pageState === "logged in") {
    let stillGoing = true;
    while (stillGoing && messageQueue.length > 0) {
      const message = messageQueue.shift();
      if (message.type ===  "here-have-a-model") {
        setStatus("Downloading model from host...");
        handleBurstMessage(message);
        stillGoing = false;
      }
    }
  } else if (pageState === "booted up") {
    setStatus("Model loaded and ready for you to use!");
    while (messageQueue.length > 0) {
      const message = messageQueue.shift();
      handleBurstMessage(message);
    }
  } else {
    console.log("Skipping while in state: ", pageState);
  }

}

// (Object[Any]) => Unit
const handleBurstMessage = (datum) => {

  switch (datum.type) {

    case "here-have-a-model":

      const username = document.getElementById('username').value;

      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
        type:  "hnw-load-interface"
      , username
      , role:  datum.role
      , token: datum.token
      , view:  datum.view
      }, "*");

      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
        type:   "nlw-state-update"
      , update: datum.state
      }, "*");

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
    response.text().then((base64) => { image.src = base64; })
  });
};

// () => Unit
const cleanupSession = () => {
  switchToServerBrowser();
  alert("Connection to host lost");
};

// () => Unit
const switchToNLW = () => {
  const formFrame = document.getElementById("server-browser-frame");
  const  nlwFrame = document.getElementById(           "nlw-frame");
  formFrame.classList.add(   "hidden");
  nlwFrame .classList.remove("hidden");
  history.pushState({ name: "joined" }, "joined");
  pageState = "logged in";
};

// () => Unit
const switchToServerBrowser = () => {
  const formFrame = document.getElementById("server-browser-frame");
  const  nlwFrame = document.getElementById(           "nlw-frame");
  nlwFrame .classList.add(   "hidden");
  formFrame.classList.remove("hidden");
  serverListSocket = openListSocket();
  nlwFrame.querySelector("iframe").contentWindow.postMessage({ type: "nlw-open-new" }, "*");
};

// (String) => Unit
const setStatus = (statusText) => {
  document.getElementById('status-value').innerText = statusText;
}

window.addEventListener('message', (event) => {
  switch (event.data.type) {
    case "relay":
      if (event.data.payload.type === "interface-loaded") {
        pageState = "booted up";
      } else {
        const hostID = document.querySelector('.active').dataset.uuid;
        sendObj(channels[hostID])("relay", event.data);
      }
      break;
    default:
      console.warn(`Unknown message type: ${event.data.type}`);
  }
})

window.addEventListener('popstate', (event) => {
  if (event.state !== null && event.state !== undefined) {
    switch (event.state.name) {
      case "joined":
        switchToServerBrowser();
      default:
        console.warn(`Unknown state: ${event.state.name}`);
    }
  }
});

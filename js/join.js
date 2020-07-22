const placeholderB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";
document.getElementById('session-preview-image').src = placeholderB64;

// type Session = { modelName :: String, name :: String, oracleID :: String }
let sessionData = []; // Array[Session]

let channels = {}; // Object[RTCDataChannel]

window.joinerConnection = new RTCPeerConnection(joinerConfig);

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
};

// () => Unit
window.join = () => {
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
      const channel = joinerConnection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
      return joinerConnection.createOffer().then((offer) => [joinerID, channel, offer]);
    }
  ).then(
    ([joinerID, channel, offer]) => {

      let knownCandies = new Set([]);

      joinerConnection.onicecandidate =
        ({ candidate }) => {
          if (candidate !== undefined && candidate !== null) {
            const candy = JSON.stringify(candidate.toJSON());
            if (!knownCandies.has(candy)) {
              knownCandies = knownCandies.add(candy);
              sendObj(narrowSocket)("joiner-ice-candidate", { candidate: candidate.toJSON() });
            }
          }
        }

      joinerConnection.setLocalDescription(offer);

      const narrowSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${joinerID}/join`);

      channels[hostID] = channel;

      channel.onopen    = () => login(channel);
      channel.onmessage = handleChannelMessages(channel, narrowSocket);
      channel.onclose   = () => cleanupSession();

      narrowSocket.addEventListener('open', () => sendObj(narrowSocket)("joiner-offer", { offer }));

      narrowSocket.addEventListener('message', ({ data }) => {
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
          default:
            console.log(`Unknown message type: ${datum.type}`);
        };
      });

      joinerConnection.oniceconnectionstatechange = () => {
        if (joinerConnection.iceConnectionState == "disconnected") {
          cleanupSession();
        }
      };

    }
  );

};

const serverListSocket = new WebSocket(`ws://localhost:8080/hnw/session-stream`);

serverListSocket.addEventListener('message', ({ data }) => {
  sessionData = JSON.parse(data);
  filterSessionList();
});

// (RTCDataChannel) => Unit
const login = (channel) => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  sendObj(channel)("login", { username, password });
}

// (RTCDataChannel, WebSocket) => (Any) => Unit
const handleChannelMessages = (channel, socket) => ({ data }) => {

  const datum = JSON.parse(data);

  switch (datum.type) {

    case "login-successful":
      socket.close();
      switchToNLW();
      break;

    case "incorrect-password":
      alert("Bad password, pal—real bad!");
      break;

    case "username-already-taken":
      alert("Username already in use!");
      break;

    case "rtc-burst-begin":
    case "rtc-burst-continue":
    case "rtc-burst-end":
      manageBurstMessage(channel, socket, datum);
      break;

    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);

  }

};

// (RTCDataChannel, WebSocket, Any) => Unit
const manageBurstMessage = (channel, socket, datum) => {
  switch (datum.type) {
    case "rtc-burst-begin":
      rtcBursts[datum.id] = "";
      break;
    case "rtc-burst-continue":
      rtcBursts[datum.id] += datum.parcel;
      break;
    case "rtc-burst-end":
      const fullShipment = JSON.parse(decompress(rtcBursts[datum.id]));
      delete rtcBursts[datum.id];
      handleBurstMessage(channel, socket, fullShipment);
      break;
    default:
      console.warn(`Unknown burst event type: ${datum.type}`);
  }
};

// (RTCDataChannel, WebSocket, Any) => Unit
const handleBurstMessage = (channel, socket, datum) => {

  switch (datum.type) {

    case "here-have-a-model":
      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
        nlogo: datum.nlogo,
        path:  datum.sessionName,
        type:  "nlw-load-model"
      }, "*");
      break;

    case "here-have-an-update":
      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
        update: datum.update,
        type:   "nlw-apply-update"
      }, "*");
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
  window.joinerConnection = new RTCPeerConnection(joinerConfig);
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
};

// () => Unit
const switchToServerBrowser = () => {
  const formFrame = document.getElementById("server-browser-frame");
  const  nlwFrame = document.getElementById(           "nlw-frame");
  nlwFrame .classList.add(   "hidden");
  formFrame.classList.remove("hidden");
  nlwFrame.querySelector("iframe").contentWindow.postMessage({ type: "nlw-open-new" }, "*");
};

window.addEventListener('popstate', (event) => {
  switch (event.state.name) {
    case "joined":
      window.joinerConnection = new RTCPeerConnection(joinerConfig);
      switchToServerBrowser();
    default:
      console.warn(`Unknown state: ${event.state.name}`);
  }
});

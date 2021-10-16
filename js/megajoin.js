let sessionData = null; // Object[?]

const placeholderBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";

// () => Unit
const usePlaceholderPreview = () => {
  document.getElementById('session-preview-image').src = placeholderBase64;
};

usePlaceholderPreview();

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

// (String) => Unit
const setStatus = (statusText) => {
  document.getElementById('status-value').innerText = statusText;
};

// () => Unit
self.selectSession = () => {
  const activeElem = document.querySelector('.active');
  refreshSelection(activeElem !== null ? activeElem.dataset.uuid : null);
  setStatus("Session selected.  Please enter a username, enter a password (if needed), and click 'Join'.");
};

// () => Unit
self.filterSessionList = () => {
  const term     = document.getElementById('session-filter-box').value.trim().toLowerCase();
  const checkIt  = ({ name, modelName }) => name.toLowerCase().includes(term) || modelName.toLowerCase().includes(term);
  const filtered = term === '' ? sessionData : sessionData.filter(checkIt);
  populateSessionList(filtered);
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

};

// () => Unit
self.megajoin = () => {

  document.getElementById('join-button').disabled = true;

  const numClients = parseInt(document.getElementById("client-count").value);

  const frames = Array.from(document.querySelectorAll(".joiner-frame"))

  while (numClients < frames.length) {
    frames.pop().remove();
  }

  const username = document.getElementById("username").value;
  const hostID   = document.querySelector('.active').dataset.uuid;

  for (let i = 0; i < numClients; i++) {
    if (i >= frames.length) {
      let iframe = document.createElement("iframe");
      iframe.classList.add("joiner-frame");
      document.getElementById("joiner-frames").appendChild(iframe);
    }
    Array.from(document.querySelectorAll(".joiner-frame"))[i].src = `/join#${hostID},${username}-${i}`;
  }

  document.getElementById("server-browser-frame").style.display = "none";

};

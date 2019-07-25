const placeholderB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";
document.getElementById('session-preview-image').src = placeholderB64;

let sessionData = [];

window.joinerConnection = new RTCPeerConnection(joinerConfig);

const refreshSelection = function(oldActiveUUID) {

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

const populateSessionList = function(sessions) {

  const activeElem    = document.querySelector('.active');
  const oldActiveUUID = activeElem !== null ? activeElem.dataset.uuid : null;

  const image    = document.getElementById('session-preview-image');
  const template = document.getElementById('session-option-template');

  const nodes = sessions.map(
    (session) => {

      const node = template.content.cloneNode(true);
      node.querySelector(".session-name").textContent       = session.name;
      node.querySelector(".session-model-name").textContent = session.modelName;
      node.querySelector(".session-info").textContent       = `${session.roleInfo[0][1]} people`;
      node.querySelector(".session-label").dataset.uuid     = session.oracleID;
      node.querySelector(".session-option").onchange =
        function(event) {
          if (event.target.checked) {
            event.target.parentNode.classList.add("active");
            fetch(`/preview/${session.oracleID}`).then(function(response) {
              response.text().then(function(base64) {
                image.src = base64;
              })
            });
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
    } else {
      document.getElementById('session-preview-image').src = placeholderB64;
    }
  }

  container.innerHTML = "";
  nodes.forEach((node) => container.appendChild(node));

  refreshSelection(oldActiveUUID);

};

window.filterSessionList = function() {
  const term     = document.getElementById('session-filter-box').value.trim();
  const filtered = term === '' ? sessionData : sessionData.filter(({ name, modelName }) => name.includes(term) || modelName.includes(term));
  populateSessionList(filtered);
};

window.selectSession = function() {
  const activeElem = document.querySelector('.active');
  refreshSelection(activeElem !== null ? activeElem.dataset.uuid : null);
};

window.join = function() {

  const hostID = document.querySelector('.active').dataset.uuid;

  fetch(`/rtc/join/${hostID}`).then((response) => response.text()).then(
    (joinerID) => {

      const rtcID    = uuidToRTCID(joinerID);
      const channel  = joinerConnection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
      channel.onopen = function() { channel.send(`howdy, from Mr. ${rtcID}`); };

      return joinerConnection.createOffer().then((offer) => [joinerID, offer]);

    }
  ).then(
    ([joinerID, offer]) => {

      let knownCandies = new Set([]);

      joinerConnection.onicecandidate =
        ({ candidate }) => {
          if (candidate !== undefined && candidate !== null) {
            const candy = JSON.stringify(candidate.toJSON());
            if (!knownCandies.has(candy)) {
              knownCandies = knownCandies.add(candy);
              sendObj(narrowSocket, "joiner-ice-candidate", { candidate: candidate.toJSON() });
            }
          }
        }

      joinerConnection.setLocalDescription(offer);

      const narrowSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${joinerID}/join`);

      narrowSocket.addEventListener('open', () => sendObj(narrowSocket, "joiner-offer", { offer }));

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

    }
  );

};

const serverListSocket = new WebSocket(`ws://localhost:8080/hnw/session-stream`);

serverListSocket.addEventListener('message', ({ data }) => {
  sessionData = JSON.parse(data);
  filterSessionList();
});

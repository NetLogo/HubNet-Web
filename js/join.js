const placeholderB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";
document.getElementById('session-preview-image').src = placeholderB64;

let sessionData = [];

const refreshSelection = function() {

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

  const activeElem   = document.querySelector('.active');
  const activeEntry  = activeElem !== null ? sessionData.find((x) => x.oracleID === activeElem.dataset.uuid) : null;
  const shouldEnable = activeEntry !== null; // Better criteria later (especially the # of slots open in session) --JAB (6/12/19)

  document.getElementById('join-button').disabled = !shouldEnable;

};

const populateSessionList = function(sessions) {

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

  refreshSelection();

};

window.filterSessionList = function() {
  const term     = document.getElementById('session-filter-box').value.trim();
  const filtered = term === '' ? sessionData : sessionData.filter(({ name, modelName }) => name.includes(term) || modelName.includes(term));
  populateSessionList(filtered);
};

window.selectSession = function(radioButtonElem) {
  refreshSelection();
};

window.join = function() {

};

const socket = new WebSocket("ws://localhost:8080/join-ws");

socket.onmessage = function(event) {
  sessionData = JSON.parse(event.data);
  filterSessionList();
};

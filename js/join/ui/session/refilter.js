// (String, Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => Unit
export default (term, parent, seshData, statusManager, previewManager, notifySel) => {

  const matches = (haystack, needle) => haystack.toLowerCase().includes(needle);
  const checkIt = (s) => matches(s.name, term) || matches(s.modelName, term);

  if (term !== "") {
    seshData.applyFilter(checkIt);
  } else {
    seshData.clearFilter();
  }

  populate(parent, seshData, statusManager, previewManager, notifySel);

};

// (Element, String) => Element?
const descByID = (elem, id) => elem.querySelector(`#${id}`);

// (Element) => UUID
const getID = (elem) => elem.dataset.uuid;

// (Element, SessionData, SelNotifier) => Unit
const refreshSelection = (parent, seshData, notifyNewSelection) => {

  const container = descByID(parent, "session-option-container");
  Array.from(container.querySelectorAll(".session-label")).forEach(
    (label) => {
      if (label.querySelector(".session-option").checked) {
        label.classList.add("active");
      } else {
        label.classList.remove("active");
      }
    }
  );

  const activeElem      = parent.querySelector(".active");
  const uuid            = (activeElem !== null) ? activeElem.dataset.uuid : null;
  const selectedSession = (activeElem !== null) ? seshData.lookup(uuid)   : null;

  notifyNewSelection(selectedSession);

};

// (Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => (Object[Session]) => Node
const genSessionNode = (parent, seshData, statusManager, previewManager, notifySel) =>
                       ({ modelName, name, oracleID, roleInfo: [[ , numClients]] }) => {

  const node = descByID(parent, "session-option-template").content.cloneNode(true);

  node.querySelector(".session-name").textContent       = name;
  node.querySelector(".session-model-name").textContent = modelName;
  node.querySelector(".session-info").textContent       = `${numClients} people`;
  node.querySelector(".session-label").dataset.uuid     = oracleID;

  node.querySelector(".session-option").addEventListener("change", (event) => {

    if (event.target.checked) {

      event.target.parentNode.classList.add("active");
      previewManager.fetch(oracleID);

      refreshSelection(parent, seshData, notifySel);
      statusManager.enterLoginInfo();

    } else {
      node.querySelector(".session-label").classList.remove("active");
    }

  });

  return node;

};

// (Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => Unit
const populate = (parent, seshData, statusManager, previewManager, notifySel) => {

  const lower   = (x)    => x.name.toLowerCase();
  const comp    = (a, b) => (lower(a) < lower(b)) ? -1 : 1;
  const genNode = genSessionNode(parent, seshData, statusManager, previewManager, notifySel);
  const nodes   = seshData.get().sort(comp).map(genNode);

  const container = descByID(parent, "session-option-container");
  const labels    = Array.from(container.querySelectorAll(".session-label"));
  const selected  = labels.find((l) => l.querySelector(".session-option").checked);

  if (selected !== undefined) {

    const matches = (node) =>
      getID(node.querySelector(".session-label")) === getID(selected);

    const match = nodes.find(matches);

    if (match !== undefined) {
      match.querySelector(".session-option").checked = true;
      previewManager.fetch(getID(selected));
    } else {
      previewManager.useDefault();
    }

  } else {
    if (!seshData.isEmpty()) {
      statusManager.awaitingSelection();
    } else if (!seshData.isEmptyUnfiltered()) {
      statusManager.allSessionsHidden();
    } else {
      statusManager.awaitingNewSessions();
    }
  }

  container.innerHTML = "";
  nodes.forEach((node) => container.appendChild(node));

  refreshSelection(parent, seshData, notifySel);

};


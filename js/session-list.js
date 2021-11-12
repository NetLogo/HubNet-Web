import SessionData   from "./session-data.js";
import SessionStream from "./session-stream.js";

import usePlaceholderPreview from "./use-placeholder-preview.js";

// type SelNotifier = (SessionData, Element, UUID) => Unit

// (Element, String) => Element?
const descByID = (elem, id) => elem.querySelector(`#${id}`);

// (Element) => String
const extractQuery = (elem) => elem.value.trim().toLowerCase();

// (Element) => UUID
const getID = (elem) => elem.dataset.uuid;

export default class SessionList {

  #stream = undefined; // SessionStream

  // (Element, SessionData, AppStatusManager, SelNotifier) => SessionList
  constructor(parent, onStreamInit, statusManager, notifySel) {

    const filterBox = descByID(parent, "session-filter-box");
    const data      = new SessionData();

    this.#stream = this.#genSessionStream( filterBox, parent, data, statusManager
                                         , notifySel, onStreamInit);

    usePlaceholderPreview();

    this.#initListeners(filterBox, parent, data, statusManager, notifySel);

  }

  // () => Unit
  enable = () => {
    this.#stream.connect();
  };

  // () => Unit
  hibernate = () => {
    this.#stream.hibernate();
  };

  // (Element, SessionData, AppStatusManager, SelNotifier) => (Object[Session]) => Node
  #genSessionNode = (parent, seshData, statusManager, notifySel) =>
                    ({ modelName, name, oracleID, roleInfo: [[ , numClients]] }) => {

    const node = descByID(parent, "session-option-template").content.cloneNode(true);

    node.querySelector(".session-name").textContent       = name;
    node.querySelector(".session-model-name").textContent = modelName;
    node.querySelector(".session-info").textContent       = `${numClients} people`;
    node.querySelector(".session-label").dataset.uuid     = oracleID;

    node.querySelector(".session-option").addEventListener("change", (event) => {

      if (event.target.checked) {

        event.target.parentNode.classList.add("active");
        this.#refreshImage(parent, oracleID);

        this.#refreshSelection(parent, seshData, notifySel);
        statusManager.enterLoginInfo();

      } else {
        node.querySelector(".session-label").classList.remove("active");
      }

    });

    return node;

  };

  // (Element, Element, SessionData, AppStatusManager, SelNotifier, (SessionData) => Unit) => SessionStream
  #genSessionStream = ( filterBox, parent, seshData, statusManager, notifySel
                      , onStreamInit) => {
    return new SessionStream(
      ({ data }) => {

        const wasInited = seshData.hasBeenInitialized();

        seshData.set(JSON.parse(data));

        this.#refilter( extractQuery(filterBox), parent, seshData
                      , statusManager, notifySel);

        if (!wasInited) {
          onStreamInit(seshData);
        }

      }
    );
  };

  // (Element, Element, SessionData, AppStatusManager, SelNotifier) => Unit
  #initListeners = (filterBox, parent, data, statusManager, notifySel) => {
    filterBox.addEventListener("input", () => {
      const query = extractQuery(filterBox);
      this.#refilter(query, parent, data, statusManager, notifySel);
    });
  };

  // (Element, SessionData, AppStatusManager, SelNotifier) => Unit
  #populate = (parent, seshData, statusManager, notifySel) => {

    const lower   = (x)    => x.name.toLowerCase();
    const comp    = (a, b) => (lower(a) < lower(b)) ? -1 : 1;
    const genNode = this.#genSessionNode(parent, seshData, statusManager, notifySel);
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
        this.#refreshImage(parent, getID(selected));
      } else {
        usePlaceholderPreview();
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

    this.#refreshSelection(parent, seshData, notifySel);

  };

  // (String, Element, SessionData, AppStatusManager, SelNotifier) => Unit
  #refilter = (term, parent, seshData, statusManager, notifySel) => {

    const matches = (haystack, needle) => haystack.toLowerCase().includes(needle);
    const checkIt = (s) => matches(s.name, term) || matches(s.modelName, term);

    if (term !== "") {
      seshData.applyFilter(checkIt);
    } else {
      seshData.clearFilter();
    }

    this.#populate(parent, seshData, statusManager, notifySel);

  };

  // (Element, UUID) => Unit
  #refreshImage = (parent, oracleID) => {
    const image = descByID(parent, "session-preview-image");
    fetch(`/preview/${oracleID}`).then((response) => {
      if (response.ok) {
        response.text().then((base64) => { image.src = base64; });
      } else {
        usePlaceholderPreview();
      }
    }).catch(() => { usePlaceholderPreview(); });
  };

  // (Element, SessionData, SelNotifier) => Unit
  #refreshSelection = (parent, seshData, notifyNewSelection) => {

    const oldActiveElem = parent.querySelector(".active");
    const oldActiveUUID = (oldActiveElem !== null) ? getID(oldActiveElem) : null;

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

    const activeElem = parent.querySelector(".active");

    notifyNewSelection(seshData, activeElem, oldActiveUUID);

  };

}

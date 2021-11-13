import SessionData   from "./session-data.js";
import SessionStream from "./session-stream.js";

// type SelNotifier = (SessionData, Element, UUID) => Unit

// (Element, String) => Element?
const descByID = (elem, id) => elem.querySelector(`#${id}`);

// (Element) => String
const extractQuery = (elem) => elem.value.trim().toLowerCase();

// (Element) => UUID
const getID = (elem) => elem.dataset.uuid;

export default class SessionList {

  #parent = undefined; // Element
  #stream = undefined; // SessionStream

  // (Element, (UUID) => Session?, AppStatusManager, PreviewManager, SelNotifier) => SessionList
  constructor(parent, onStreamInit, statusManager, previewManager, notifySel) {

    const filterBox = descByID(parent, "session-filter-box");
    const data      = new SessionData();

    this.#parent = parent;
    this.#stream = this.#genSessionStream( filterBox, parent, data, statusManager
                                         , previewManager, notifySel, onStreamInit);

    previewManager.useDefault();

    this.#initListeners( filterBox, parent, data, statusManager
                       , previewManager, notifySel);

  }

  // () => Unit
  enable = () => {
    this.#stream.connect();
  };

  // () => UUID?
  getSelectedUUID = () => {
    return this.#parent.querySelector(".active").dataset.uuid;
  };

  // () => Unit
  hibernate = () => {

    const options = Array.from(this.#parent.querySelectorAll(".session-option"));
    options.forEach((o) => { o.checked = false; });

    this.#stream.hibernate();

  };

  // (Element, SessionData) => (UUID) => Session?
  #clickAndGetByUUID = (parent, seshData) => (uuid) => {
    const selector = `.session-label[data-uuid="${uuid}"] > .session-option`;
    const match    = parent.querySelector(selector);
    if (match !== null) {
      match.click();
      return seshData.lookupUnfiltered(uuid);
    } else {
      return undefined;
    }
  };

  // (Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => (Object[Session]) => Node
  #genSessionNode = (parent, seshData, statusManager, previewManager, notifySel) =>
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

        this.#refreshSelection(parent, seshData, notifySel);
        statusManager.enterLoginInfo();

      } else {
        node.querySelector(".session-label").classList.remove("active");
      }

    });

    return node;

  };

  // (Element, Element, SessionData, AppStatusManager, PreviewManager, SelNotifier, (UUID) => Session?) => SessionStream
  #genSessionStream = ( filterBox, parent, seshData, statusManager
                      , previewManager, notifySel, onStreamInit) => {
    return new SessionStream(
      ({ data }) => {

        const wasInited = seshData.hasBeenInitialized();

        seshData.set(JSON.parse(data));

        this.#refilter( extractQuery(filterBox), parent, seshData
                      , statusManager, previewManager, notifySel);

        if (!wasInited) {
          onStreamInit(this.#clickAndGetByUUID(parent, seshData));
        }

      }
    );
  };

  // (Element, Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => Unit
  #initListeners = ( filterBox, parent, data, statusManager, previewManager
                   , notifySel) => {
    filterBox.addEventListener("input", () => {
      const query = extractQuery(filterBox);
      this.#refilter(query, parent, data, statusManager, previewManager, notifySel);
    });
  };

  // (Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => Unit
  #populate = (parent, seshData, statusManager, previewManager, notifySel) => {

    const lower   = (x)    => x.name.toLowerCase();
    const comp    = (a, b) => (lower(a) < lower(b)) ? -1 : 1;
    const genNode = this.#genSessionNode(parent, seshData, statusManager, previewManager, notifySel);
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

    this.#refreshSelection(parent, seshData, notifySel);

  };

  // (String, Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => Unit
  #refilter = (term, parent, seshData, statusManager, previewManager, notifySel) => {

    const matches = (haystack, needle) => haystack.toLowerCase().includes(needle);
    const checkIt = (s) => matches(s.name, term) || matches(s.modelName, term);

    if (term !== "") {
      seshData.applyFilter(checkIt);
    } else {
      seshData.clearFilter();
    }

    this.#populate(parent, seshData, statusManager, previewManager, notifySel);

  };

  // (Element, SessionData, SelNotifier) => Unit
  #refreshSelection = (parent, seshData, notifyNewSelection) => {

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

}

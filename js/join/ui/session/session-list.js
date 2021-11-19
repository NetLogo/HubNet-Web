import SessionData   from "./session-data.js";
import SessionStream from "./session-stream.js";

import refilter from "./refilter.js";

// type SelNotifier = (SessionData, Element, UUID) => Unit

export default class SessionList {

  #parent = undefined; // Element
  #stream = undefined; // SessionStream

  // (Element, (UUID) => Session?, AppStatusManager, PreviewManager, SelNotifier) => SessionList
  constructor(parent, onStreamInit, statusManager, previewManager, notifySel) {

    const filterBox = parent.querySelector("#session-filter-box");
    const data      = new SessionData();

    this.#parent = parent;
    this.#stream = genSessionStream( filterBox, parent, data, statusManager
                                   , previewManager, notifySel, onStreamInit);

    previewManager.useDefault();

    initListeners(filterBox, parent, data, statusManager, previewManager, notifySel);

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

}

// (Element) => String
const extractQuery = (elem) => elem.value.trim().toLowerCase();

// ( Element, Element, SessionData, AppStatusManager
// , PreviewManager, SelNotifier, (UUID) => Session?) => SessionStream
const genSessionStream = ( filterBox, parent, seshData, statusManager
                         , previewManager, notifySel, onStreamInit) => {
  return new SessionStream(
    ({ data }) => {

      const wasInited = seshData.hasBeenInitialized();

      seshData.set(JSON.parse(data));

      refilter( extractQuery(filterBox), parent, seshData
              , statusManager, previewManager, notifySel);

      if (!wasInited) {
        onStreamInit(clickAndGetByUUID(parent, seshData));
      }

    }
  );
};

// (Element, Element, SessionData, AppStatusManager, PreviewManager, SelNotifier) => Unit
const initListeners = ( filterBox, parent, data, statusManager, previewManager
                      , notifySel) => {
  filterBox.addEventListener("input", () => {
    const query = extractQuery(filterBox);
    refilter(query, parent, data, statusManager, previewManager, notifySel);
  });
};

// (Element, SessionData) => (UUID) => Session?
const clickAndGetByUUID = (parent, seshData) => (uuid) => {
  const selector = `.session-label[data-uuid="${uuid}"] > .session-option`;
  const match    = parent.querySelector(selector);
  if (match !== null) {
    match.click();
    return seshData.lookupUnfiltered(uuid);
  } else {
    return undefined;
  }
};

import { parse } from "/depend/js/marked.esm.js";

import { InvalidUpload, ValidUpload, processUploads } from "./model-upload.js";

export default class LaunchControlManager {

  #awaitLaunchHTTP = undefined; // (Object[Any]) => Promise[Response]
  #elem            = undefined; // Element
  #notifyUser      = undefined; // (String) => Unit
  #password        = undefined; // String
  #upload          = undefined; // Upload

  // (Element, (Object[Any]) => Promise[Response], (String) => Unit, (Object[Any]) => Unit) => LaunchControlManager
  constructor(elem, awaitLaunchHTTP, notifyUser, finishLaunch, getLibrary) {

    this.#awaitLaunchHTTP = awaitLaunchHTTP;
    this.#elem            = elem;
    this.#notifyUser      = notifyUser;
    this.#upload          = InvalidUpload;

    elem.querySelector("form").onsubmit = this.#onSubmit(finishLaunch);

    const byEID = (s) => elem.querySelector(`#${s}`);

    byEID("library-model").onchange = this.#onChange(getLibrary);

    byEID("file-upload-input").onchange = () => {
      this.#updateUploadValidity();
    };

    byEID("upload-button").onclick = () => {

      byEID( "upload-button").classList   .add("active");
      byEID("library-button").classList.remove("active");

      byEID( "upload-container").classList.remove("hidden");
      byEID("library-container").classList   .add("hidden");

      this.#updateUploadValidity();

    };

    byEID("library-button").onclick = () => {

      byEID( "upload-button").classList.remove("active");
      byEID("library-button").classList   .add("active");

      byEID( "upload-container").classList   .add("hidden");
      byEID("library-container").classList.remove("hidden");

      byEID("file-upload-input").setCustomValidity("");

    };

  }

  // (Object[Any]) => Promise[(FormData, Response, Object[Any])]
  launch = (conf) => {

    const config = { ...conf };

    if (config.password === "") {
      delete config.password;
      this.#password = null;
    } else {
      this.#password = config.password;
    }

    return awaitNlogo(config).
      then(awaitLaunch(this.#awaitLaunchHTTP)).
      then(awaitProcessResponse(this.#elem, this.#notifyUser, config));

  };

  // (String) => Boolean
  passwordMatches = (password) => {
    return this.#password === null || this.#password === password;
  };

  // (Object[Any]) => Unit
  refreshInfo = (libraryConfig) => {
    const elem = this.#elem.querySelector(".library-model");
    this.#refresh(libraryConfig, elem);
  };

  // ((Object[Any]) => Unit) => () => Unit
  #onSubmit = (finishLaunch) => () => {

    const getDOM = (s) => this.#elem.querySelector(s);

    const formData    = new FormData(getDOM("form"));
    const sessionName = formData.get("sessionName");
    const password    = formData.get("password");

    const basis  = { sessionName, password };
    let   extras = undefined;

    if (getDOM("#library-button").classList.contains("active")) {
      extras = { modelType: "library", model: formData.get("libraryModel") };
    } else if (this.#upload instanceof ValidUpload) {
      const model  = this.#upload.getNlogo();
      const config = this.#upload.getJson();
      extras = { modelType: "upload", model, config };
    } else {
      throw new Error("Invalid upload format", this.#upload);
    }

    const conf = Object.assign(basis, extras);
    this.launch(conf).then(finishLaunch);

    return true;

  };

  // (() => Object[Any]) => (Event) => Unit
  #onChange = (getLibraryConfig) => (e) => {
    this.#refresh(getLibraryConfig(), e.target);
  };

  #refresh = (libConfig, selectElem) => {

    const getDOM    = (s) => this.#elem.querySelector(s);
    const toSummary = (s) => s.split("\n", 1)[0];

    const modelName   = selectElem.selectedOptions[0].value;
    const description = libConfig[modelName];

    if (description !== undefined) {
      const opts = { headerIds: false, mangle: false };
      getDOM(".modal-activity-title").innerText = modelName;
      getDOM("#activity-text-full"  ).innerHTML = parse(          description , opts);
      getDOM("#activity-text-short" ).innerHTML = parse(toSummary(description), opts);
      getDOM("#preview-image"       ).src       = `/previews/${modelName} HubNet.png`;
    }

  };

  // () => Unit
  #updateUploadValidity = () => {

    const finput = this.#elem.querySelector("#file-upload-input");
    finput.setCustomValidity("");

    const setUpload    = (u)   => { this.#upload = u; };
    const setValidator = (msg) => { finput.setCustomValidity(msg); };
    processUploads(finput.files, setUpload, setValidator);

  };

}

// (Object[Any]) => Promise[Object[Any]]
const awaitNlogo = (conf) => {
  const config = { ...conf };
  return new Promise(
    (resolve) => {
      const model = config.model;
      if (model instanceof File) {
        const reader = new FileReader();
        reader.onloadend = (event) => {
          config.model = event.target.result;
          resolve(config);
        };
        reader.readAsText(model);
      } else {
        resolve(config);
      }
    }
  );
};

// (Object[Any], (Object[Any]) => Promise[Response]) => Promise[Response]
const awaitLaunch = (awaitLaunchHTTP) => (config) => {

  const data =
    { method:  "POST"
    , headers: { "Content-Type": "application/json" }
    , body:    JSON.stringify(config)
    };

  return awaitLaunchHTTP(data);

};

// (Element, (String) => Unit, Object[Any]) => (Response) => Promise[Object[Any]]
const awaitProcessResponse = (frame, notifyUser, config) => (response) => {

  if (response.status === 200) {

    return response.json().then(
      ({ id: hostID, type, nlogoMaybe, jsonMaybe }) => {

        const canDealWith = type === "from-library" || type === "from-upload";
        const nlogo       = canDealWith ? nlogoMaybe            : "invalid model type";
        const json        = canDealWith ? JSON.parse(jsonMaybe) : "invalid model JSON";

        frame.classList.add("hidden");

        return { isSuccess: true, data: { hostID, json, nlogo }, config };

      }
    );

  } else {
    return response.text().then((body) => {
      notifyUser(JSON.stringify(body));
      return { isSuccess: false };
    });
  }

};

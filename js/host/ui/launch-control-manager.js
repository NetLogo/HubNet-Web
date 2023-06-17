import { parse } from "/depend/js/marked.esm.js";

export default class LaunchControlManager {

  #awaitLaunchHTTP = undefined; // (Object[Any]) => Promise[Response]
  #elem            = undefined; // Element
  #notifyUser      = undefined; // (String) => Unit
  #password        = undefined; // String

  // (Element, (Object[Any]) => Promise[Response], (String) => Unit, (Object[Any]) => Unit) => LaunchControlManager
  constructor(elem, awaitLaunchHTTP, notifyUser, finishLaunch, getLibrary) {

    this.#awaitLaunchHTTP = awaitLaunchHTTP;
    this.#elem            = elem;
    this.#notifyUser      = notifyUser;

    elem.querySelector(          "form").onsubmit = this.#onSubmit(finishLaunch);
    elem.querySelector(".library-model").onchange = this.#onChange(  getLibrary);

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

    const formData = new FormData(this.#elem.querySelector("form"));
    const model    = formData.get("libraryModel");

    const config = { modelType:   "library"
                   , sessionName: formData.get("sessionName")
                   , password:    formData.get("password")
                   , model
                   };

    this.launch(config).then(finishLaunch);

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

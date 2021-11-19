export default class LaunchControlManager {

  #awaitLaunchHTTP = undefined; // (Object[Any]) => Promise[Response]
  #elem            = undefined; // Element
  #notifyUser      = undefined; // (String) => Unit
  #password        = undefined; // String

  // (Element, (Object[Any]) => Promise[Response], (String) => Unit, (Object[Any]) => Unit) => LaunchControlManager
  constructor(elem, awaitLaunchHTTP, notifyUser, finishLaunch) {

    this.#awaitLaunchHTTP = awaitLaunchHTTP;
    this.#elem            = elem;
    this.#notifyUser      = notifyUser;

    this.#elem.querySelector("form").onsubmit = this.#onSubmit(finishLaunch);

  }

  // (Object[Any]) => Promise[(FormData, Response)]
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
      then(awaitProcessResponse(this.#elem, this.#notifyUser));

  };

  // (String) => Boolean
  passwordMatches = (password) => {
    return this.#password === null || this.#password === password;
  };

  // ((Object[Any]) => Unit) => () => Unit
  #onSubmit = (finishLaunch) => () => {

    const formData = new FormData(this.#elem.querySelector("form"));
    const model    = formData.get("libraryModel").slice(4);

    const config = { modelType:   "library"
                   , sessionName: formData.get("sessionName")
                   , password:    formData.get("password")
                   , model
                   };

    this.launch(config).then(finishLaunch);

    return true;

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

// (Element, (String) => Unit) => (Response) => Promise[Object[Any]]
const awaitProcessResponse = (frame, notifyUser) => (response) => {

  if (response.status === 200) {

    return response.json().then(
      ({ id: hostID, type, nlogoMaybe, jsonMaybe }) => {

        const canDealWith = type === "from-library" || type === "from-upload";
        const nlogo       = canDealWith ? nlogoMaybe            : "invalid model type";
        const json        = canDealWith ? JSON.parse(jsonMaybe) : "invalid model JSON";

        frame.classList.add("hidden");

        return { isSuccess: true, data: { hostID, json, nlogo } };

      }
    );

  } else {
    return response.text().then((body) => {
      notifyUser(JSON.stringify(body));
      return { isSuccess: false };
    });
  }

};

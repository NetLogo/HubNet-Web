// type Session = { channel :: WebSocket, username :: String }

let sessions = {}; // Object[Session]

let password = null; // String

let statusSocket = null; // WebSocket

let lastImageUpdate = undefined; // Base64String

// (DOMElement) => Boolean
window.submitLaunchForm = (elem) => {

  const formData = new FormData(elem);

  const formDataPlus =
    { 'modelType':   "library"
    , 'sessionName': formData.get('sessionName')
    , 'password':    formData.get('password')
    };

  if (formDataPlus.password === "")
    delete formDataPlus.password;
  else
    password = formDataPlus.password;

  switch (formDataPlus.modelType) {
    case "library":
      const lm               = formData.get('libraryModel');
      formDataPlus.model     = lm;
      formDataPlus.modelName = lm;
      break;
    case "upload":

      if (!elem.querySelector('#upload-model').value.endsWith('.nlogo')) {
        alert("Please upload a valid '.nlogo' file, or choose a file from the library.");
        return false;
      }

      formDataPlus.model     = formData.get('uploadModel');
      formDataPlus.modelName = extractModelName(elem.querySelector('#upload-model').value);

      break;

    default:
      console.warn(`Unknown model source: ${formDataPlus.modelType}`);
  }

  new Promise(
    (resolve, reject) => {

      if (formDataPlus.model instanceof File) {
        let reader = new FileReader();
        reader.onloadend = (event) => {
          resolve([formDataPlus, event.target]);
        };
        reader.readAsText(formDataPlus.model);
      } else {
        resolve([formDataPlus, formDataPlus.model])
      }

    }
  ).then(([fdp, fileEvent]) => {
    const modelUpdate = fileEvent.result !== undefined ? { model: fileEvent.result } : {}
    return { ...fdp, ...modelUpdate };
  }).then((fddp) => {

    const data =
      { method:  'POST'
      , headers: { 'Content-Type': 'application/json' }
      , body:    JSON.stringify(fddp)
      };

    return fetch('/x-launch-session', data).then((response) => [fddp, response]);

  }).then(([formDataLike, response]) => {

    if (response.status === 200) {

      response.json().then(({ id: hostID, type, nlogoMaybe, jsonMaybe }) => {

        document.getElementById('id-display').innerText = hostID;

        const nlogo       = type === "from-library" ? nlogoMaybe : formDataLike.model;
        const json        = type === "from-library" ? JSON.parse(jsonMaybe) : "get wrecked";
        const sessionName = formDataLike.sessionName;

        const formFrame = document.getElementById("form-frame");
        const  nlwFrame = document.getElementById( "nlw-frame");

        formFrame.classList.add(   "hidden");
        nlwFrame .classList.remove("hidden");
        history.pushState({ name: "hosting" }, "hosting");

        const babyDearest = nlwFrame.querySelector('iframe').contentWindow;

        babyDearest.postMessage({
          ...json
        , nlogo: nlogo
        , type: "hnw-become-oracle"
        }, "*");

        babyDearest.postMessage({ type: "nlw-subscribe-to-updates", uuid: hostID }, "*");

        const broadSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}`);

        broadSocket.onmessage = ({ data }) => {
          const datum = JSON.parse(data);
          switch (datum.type) {
            case "hello":
              const joinerID     = datum.joinerID
              const channel      = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${joinerID}/host`);
              channel.onmessage  = handleChannelMessages(channel, nlogo, sessionName, joinerID);
              channel.onclose    = () => { cleanupSession(joinerID); };
              sessions[joinerID] = { channel };
              break;
            default:
              console.warn(`Unknown broad event type: ${datum.type}`);
          }
        };

        statusSocket = new WebSocket(`ws://localhost:8080/hnw/my-status/${hostID}`);

        setInterval(() => {
          const seshSockets = Object.values(sessions).map((session) => session.channel);
          const allSockets  = seshSockets.concat([broadSocket, statusSocket]);
          allSockets.forEach((socket) => sendObj(socket)("keep-alive", {}));
        }, 30000);

        setInterval(() => {
          const numPeers = Object.values(sessions).filter((s) => s.username !== undefined).length;
          sendObj(statusSocket)("members-update", { numPeers });
        }, 1000);

        setInterval(() => {
          babyDearest.postMessage({ type: "nlw-request-view" }, "*");
        }, 8000);

      });

    } else {
      response.text().then((body) => { alert(JSON.stringify(body)); });
    }

  });

  return true;

};

// (RTCDataChannel, String, String, String) => (Any) => Unit
const handleChannelMessages = (channel, nlogo, sessionName, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "login":
      handleLogin(channel, nlogo, sessionName, datum, joinerID);
      break;
    case "relay":
      const babyDearest = document.getElementById("nlw-frame").querySelector('iframe').contentWindow;
      babyDearest.postMessage(datum.payload, "*");
      break;
    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);
  }
};

// (RTCDataChannel, String, String, { username :: String, password :: String }, String) => Unit
const handleLogin = (channel, nlogo, sessionName, datum, joinerID) => {

  if (datum.username !== undefined) {

    const joinerUsername  = datum.username.toLowerCase();
    const relevantSeshes  = Object.entries(sessions).filter(([k, v]) => k !== joinerID).map(([k, v]) => v);
    const usernameIsTaken = relevantSeshes.some((s) => s.username.toLowerCase() === joinerUsername);

    if (!usernameIsTaken) {
      if (password === null || password === datum.password) {

        sessions[joinerID].username      = datum.username;
        sessions[joinerID].isInitialized = false;
        sendObj(channel)("login-successful", {});

        const babyDearest = document.getElementById("nlw-frame").querySelector('iframe').contentWindow;
        babyDearest.postMessage({
          type:     "hnw-request-initial-state"
        , token:    joinerID
        , roleName: "student"
        , username: sessions[joinerID].username
        }, "*");

      } else {
        sendObj(channel)("incorrect-password", {});
      }
    } else {
      sendObj(channel)("username-already-taken", {});
    }

  } else {
    sendObj(channel)("no-username-given", {});
  }

};

// (String) => Unit
const cleanupSession = (joinerID) => {
  delete sessions[joinerID];
};

// () => Unit
const cleanupHostingSession = () => {
  location.reload();
};

window.addEventListener("message", ({ data }) => {

  const narrowcast = (type, message, recipientUUID) => {
    const sesh = sessions[recipientUUID];
    if (sesh !== undefined && sesh.channel !== undefined && sesh.channel.readyState === "open")
      sendRTCBurst(channel)(type, message);
  }

  const broadcast = (type, message) => {
    const channels = Object.values(sessions).map((s) => s.channel).filter((c) => c !== undefined && c.readyState === WebSocket.OPEN)
    sendRTCBurst(...channels)(type, message);
  }

  switch (data.type) {
    case "nlw-state-update":
      if (data.recipient !== undefined)
        narrowcast("here-have-an-update", { update: data.update }, data.recipient);
      else
        broadcast("here-have-an-update", { update: data.update });
      break;
    case "nlw-view":
      if (lastImageUpdate !== data.base64) {
        lastImageUpdate = data.base64;
        sendObj(statusSocket)("image-update", { base64: data.base64 });
      }
      break;
    case "hnw-initial-state":
      const { token, role, state, viewState } = data;
      sendRTCBurst(sessions[token].channel)("here-have-a-model", { role, token, state, view: viewState });
      break;
    case "relay":
      if (data.recipient === undefined)
        broadcast("relay", data);
      else
        narrowcast("relay", data, data.recipient);
      break;
    case "nlw-resize":
      break;
    default:
      console.warn(`Unknown postMessage type: ${data.type}`);
  }

});

window.addEventListener('popstate', (event) => {
  switch (event.state.name) {
    case "hosting":
      cleanupHostingSession();
    default:
      console.warn(`Unknown state: ${event.state.name}`);
  }
});

// (String) => String
const extractModelName = (path) => (/(?:.*[/\\])?(.*)/).exec(path)[1].replace(/\.nlogo$/, "");

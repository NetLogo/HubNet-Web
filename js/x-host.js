// type Session = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket, username :: String }

let sessions = {}; // Object[Session]

let password = null; // String

let statusSocket = null; // WebSocket

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
              const connection   = new RTCPeerConnection(hostConfig);
              const narrowSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${datum.joinerID}/host`);
              narrowSocket.addEventListener('message', handleNarrowMessage(connection, nlogo, sessionName, datum.joinerID));
              sessions[datum.joinerID] = { socket: narrowSocket };
              break;
            default:
              console.warn(`Unknown broad event type: ${datum.type}`);
          }
        };

        statusSocket = new WebSocket(`ws://localhost:8080/hnw/my-status/${hostID}`);

        setInterval(() => {
          sendObj(broadSocket, "keep-alive", {});
        }, 30000);

        setInterval(() => {
          const numPeers = Object.values(sessions).filter((s) => s.username !== undefined).length;
          sendObj(statusSocket, "members-update", { numPeers });
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

// (RTCPeerConnection, String, String, String) => (Any) => Unit
const handleNarrowMessage = (connection, nlogo, sessionName, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "joiner-offer":
      processOffer(connection, nlogo, sessionName, joinerID)(datum.offer);
      break;
    case "joiner-ice-candidate":
      connection.addIceCandidate(datum.candidate);
      break;
    default:
      console.warn(`Unknown narrow event type: ${datum.type}`);
  }
};

// (RTCPeerConnection, String, String, String) => (RTCSessionDescription) => Unit
const processOffer = (connection, nlogo, sessionName, joinerID) => (offer) => {

  const rtcID       = uuidToRTCID(joinerID);
  const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
  channel.onmessage = handleChannelMessages(channel, nlogo, sessionName, joinerID);
  channel.onclose   = () => { cleanupSession(joinerID); };

  const session = sessions[joinerID];

  session.connection = connection;
  session.channel    = channel;

  let knownCandies = new Set([]);

  connection.onicecandidate =
    ({ candidate }) => {
      if (candidate !== undefined && candidate !== null) {
        const candy = JSON.stringify(candidate.toJSON());
        if (!knownCandies.has(candy)) {
          knownCandies = knownCandies.add(candy);
          sendObj(session.socket, "host-ice-candidate", { candidate: candidate.toJSON() });
        }
      }
    }

  connection.oniceconnectionstatechange = () => {
    if (connection.iceConnectionState == "disconnected") {
      cleanupSession(joinerID);
    }
  };

  connection.setRemoteDescription(offer)
    .then(()     => connection.createAnswer())
    .then(answer => connection.setLocalDescription(answer))
    .then(()     => sendObj(session.socket, "host-answer", { answer: connection.localDescription }));

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

  sessions[joinerID].socket.close();

  const joinerUsername  = datum.username.toLowerCase();
  const relevantSeshes  = Object.entries(sessions).filter(([k, v]) => k !== joinerID).map(([k, v]) => v);
  const usernameIsTaken = relevantSeshes.some((s) => s.username.toLowerCase() === joinerUsername);

  if (!usernameIsTaken) {
    if (password === null || password === datum.password) {

      sessions[joinerID].username      = datum.username;
      sessions[joinerID].isInitialized = false;
      sendRTC(channel)("login-successful", {});

      const babyDearest = document.getElementById("nlw-frame").querySelector('iframe').contentWindow;
      babyDearest.postMessage({ type: "hnw-request-initial-state", token: joinerID, roleName: "student" }, "*");

    } else {
      sendRTC(channel)("incorrect-password", {});
    }
  } else {
    sendRTC(channel)("username-already-taken", {});
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

  const broadcast = (type, message) => {
    const channels = Object.values(sessions).map((s) => s.channel).filter((c) => c !== undefined && c.readyState === "open")
    sendRTCBurst(...channels)(type, message);
  }

  switch (data.type) {
    case "nlw-state-update":
      broadcast("here-have-an-update", { update: data.update });
      break;
    case "nlw-view":
      sendObj(statusSocket, "image-update", { base64: data.base64 });
      break;
    case "hnw-initial-state":
      const { token, role, state, viewState } = data;
      sendRTCBurst(sessions[token].channel)("here-have-a-model", { role, token, state, view: viewState });
      break;
    case "relay":
      broadcast("relay", data);
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

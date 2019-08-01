// type Session = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket, username :: String }

let sessions = {}; // Object[Session]

let password = null; // String

// (String) => Unit
window.ownModelTypeChange = function(mode) {
  switch(mode) {
    case "library":
      document.getElementById("library-model").style.display = "";
      document.getElementById("upload-model").style.display  = "none";
      break;
    case "upload":
      document.getElementById("library-model").style.display = "none";
      document.getElementById("upload-model").style.display  = "";
      break;
    default:
      console.warn(`Unknown model source: ${mode}`);
  }
};

// (DOMElement) => Boolean
window.submitLaunchForm = function(elem) {

  const formData = new FormData(elem);

  const formDataPlus =
    { 'modelType':   formData.get('modelType')
    , 'sessionName': formData.get('sessionName')
    , 'password':    formData.get('password')
    };

  if (formDataPlus.password === "")
    delete formDataPlus.password;
  else
    password = formDataPlus.password;

  switch(formDataPlus.modelType) {
    case "library":
      const lm    = formData.get('libraryModel');
      const index = lm.lastIndexOf('/');
      formDataPlus.model     = lm
      formDataPlus.modelName = lm.slice(((index !== -1) ? index + 1 : 0));
      break;
    case "upload":
      formDataPlus.model     = formData.get('uploadModel');
      formDataPlus.modelName = "Get name from input later";
      break;
    default:
      console.warn(`Unknown model source: ${formDataPlus.modelType}`);
  }

  new Promise(
    function(resolve, reject) {

      if (formDataPlus.model instanceof File) {
        let reader = new FileReader();
        reader.onloadend = function(event) {
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

    return fetch('/launch-session', data).then((response) => [fddp, response]);

  }).then(([formDataLike, response]) => {

    if (response.status === 200) {

      response.json().then(function({ id: hostID, type, nlogoMaybe }) {

        const nlogo = type === "from-library" ? nlogoMaybe : formDataLike.model;

        const formFrame = document.getElementById("form-frame");
        const  nlwFrame = document.getElementById( "nlw-frame");

        formFrame.classList.add(   "hidden");
        nlwFrame .classList.remove("hidden");

        const babyDearest = nlwFrame.querySelector('iframe').contentWindow;

        babyDearest.postMessage({
          nlogo,
          path:  "Mysterious HubNet Web Model.nlogo",
          type:  "nlw-load-model"
        }, "*");

        babyDearest.postMessage({ type: "nlw-subscribe-to-view-updates" }, "*");

        const broadSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}`);

        broadSocket.onmessage = ({ data }) => {
          const datum = JSON.parse(data);
          switch (datum.type) {
            case "hello":
              const connection   = new RTCPeerConnection(hostConfig);
              const narrowSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${datum.joinerID}/host`);
              narrowSocket.addEventListener('message', handleNarrowMessage(connection, nlogo, datum.joinerID));
              sessions[datum.joinerID] = { socket: narrowSocket };
              break;
            default:
              console.warn(`Unknown broad event type: ${datum.type}`);
          }
        };

      });

    } else {
      response.text().then(function(body) { alert(JSON.stringify(body)); });
    }

  });

  return false;

};

// (RTCPeerConnection, String, String) => (Any) => Unit
const handleNarrowMessage = (connection, nlogo, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "joiner-offer":
      processOffer(connection, nlogo, joinerID)(datum.offer);
      break;
    case "joiner-ice-candidate":
      connection.addIceCandidate(datum.candidate);
      break;
    default:
      console.warn(`Unknown narrow event type: ${datum.type}`);
  }
};

// (RTCPeerConnection, String, String) => (RTCSessionDescription) => Unit
const processOffer = (connection, nlogo, joinerID) => (offer) => {

  const rtcID       = uuidToRTCID(joinerID);
  const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
  channel.onmessage = handleChannelMessages(channel, nlogo, joinerID);
  channel.onclose   = () => { delete sessions[joinerID]; };

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

  connection.setRemoteDescription(offer)
    .then(()     => connection.createAnswer())
    .then(answer => connection.setLocalDescription(answer))
    .then(()     => sendObj(session.socket, "host-answer", { answer: connection.localDescription }));

};

// (RTCDataChannel, String, String) => (Any) => Unit
const handleChannelMessages = (channel, nlogo, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "login":
      handleLogin(channel, nlogo, datum, joinerID);
      break;
    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);
  }
};

// (RTCDataChannel, String, { username :: String, password :: String }, String) => Unit
const handleLogin = (channel, nlogo, datum, joinerID) => {

  sessions[joinerID].socket.close();

  const usernameIsTaken = Object.values(sessions).map((s) => s.username).some((s) => s === datum.username);

  if (!usernameIsTaken) {
    if (password === null || password === datum.password) {
      sessions[joinerID].username = datum.username;
      sendRTC(channel)("login-successful", {});
      sendRTC(channel)("here-have-a-model", { nlogo });
    } else {
      sendRTC(channel)("incorrect-password", {});
    }
  } else {
    sendRTC(channel)("username-already-taken", {});
  }

};

window.addEventListener("message", ({ data }) => {
  switch (data.type) {
    case "nlw-view-update":
      const channels = Object.values(sessions).map((s) => s.channel)
      sendRTC(...channels)("here-have-an-update", { update: data.update });
      break;
    default:
      console.warn(`Unknown postMessage type: ${data.type}`);
  }
});

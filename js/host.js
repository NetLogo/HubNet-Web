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
    return Object.assign({}, fdp, modelUpdate);
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

        const broadSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}`);

        broadSocket.onmessage = ({ data }) => {
          const datum = JSON.parse(data);
          switch (datum.type) {
            case "hello":
              const connection   = new RTCPeerConnection(hostConfig);
              const narrowSocket = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${datum.joinerID}/host`);
              narrowSocket.addEventListener('message', handleNarrowMessage(connection, datum.joinerID));
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

// (RTCPeerConnection, String) => (Any) => Unit
const handleNarrowMessage = (connection, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "joiner-offer":
      processOffer(connection, joinerID)(datum.offer);
      break;
    case "joiner-ice-candidate":
      connection.addIceCandidate(datum.candidate);
      break;
    default:
      console.warn(`Unknown narrow event type: ${datum.type}`);
  }
};

// (RTCPeerConnection, String) => (RTCSessionDescription) => Unit
const processOffer = (connection, joinerID) => (offer) => {

  const rtcID       = uuidToRTCID(joinerID);
  const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
  channel.onmessage = handleChannelMessages(joinerID, channel);
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

// (String, RTCDataChannel) => (Any) => Unit
const handleChannelMessages = (joinerID, channel) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "login":
      handleLogin(joinerID, channel, datum);
      break;
    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);
  }
};

// (String, RTCDataChannel, { username :: String, password :: String }) => Unit
const handleLogin = (joinerID, channel, datum) => {

  sessions[joinerID].socket.close();

  const usernameIsTaken = Object.values(sessions).map((s) => s.username).some((s) => s === datum.username);

  if (!usernameIsTaken) {
    if (password === null || password === datum.password) {
      sessions[joinerID].username = datum.username;
      sendRTC(channel, "login-successful", {});
    } else {
      sendRTC(channel, "incorrect-password", {});
    }
  } else {
    sendRTC(channel, "username-already-taken", {});
  }

};

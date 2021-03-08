// type Session = {
//   networking :: { socket     :: WebSocket
//                 , connection :: RTCPeerConnection
//                 , channel    :: RTCDataChannel
//                 }
// , hasInitialized :: Boolean
// , username       :: String
// }

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
      const lm               = formData.get('libraryModel').slice(4);
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
              const joinerID     = datum.joinerID;
              const connection   = new RTCPeerConnection(hostConfig);
              const socket       = new WebSocket(`ws://localhost:8080/rtc/${hostID}/${joinerID}/host`);
              socket.onmessage   = handleConnectionMessage(connection, nlogo, sessionName, joinerID);
              sessions[joinerID] = { networking: { socket }, hasInitialized: false, pingData: {} };
              break;
            default:
              console.warn(`Unknown broad event type: ${datum.type}`);
          }
        };

        statusSocket = new WebSocket(`ws://localhost:8080/hnw/my-status/${hostID}`);

        setInterval(() => {

          const channels = Object.values(sessions).map((session) => session.networking.channel);
          channels                   .forEach((channel) => sendRTC(channel)("keep-alive", {}, true));
          [broadSocket, statusSocket].forEach((socket)  => sendWS (socket )("keep-alive", {}, true));

        }, 30000);

        let lastMemberCount = undefined;
        setInterval(() => {
          const numPeers = Object.values(sessions).filter((s) => s.username !== undefined).length;
          if (lastMemberCount !== numPeers) {
            lastMemberCount = numPeers;
            sendWS(statusSocket)("members-update", { numPeers });
          }
        }, 1000);

        setInterval(() => {
          Object.values(sessions).forEach((session) => {
            if (session.networking.channel !== undefined) {
              const id = slimUUID();
              session.pingData[id] = { startTime: performance.now() };
              sendRTC(session.networking.channel)("ping", { id });
            }
          });
        }, 2000);

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

// (UUID) => String
const slimUUID = () => {
  const uuid = genUUID();
  return uuid.substr(0, uuid.indexOf('-'));
};

// (RTCPeerConnection, String, String, String) => (RTCSessionDescription) => Unit
const processOffer = (connection, nlogo, sessionName, joinerID) => (offer) => {

  const rtcID       = uuidToRTCID(joinerID);
  const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
  channel.onopen    = () => { sendGreeting(channel, HNWRTC.status); };
  channel.onmessage = handleChannelMessages(channel, nlogo, sessionName, joinerID);
  channel.onclose   = handleChannelClose(joinerID);

  const session = sessions[joinerID];

  session.networking.connection = connection;
  session.networking.channel    = channel;

  let knownCandies = new Set([]);

  connection.onicecandidate =
    ({ candidate }) => {
      if (candidate !== undefined && candidate !== null) {
        const candy = JSON.stringify(candidate.toJSON());
        if (!knownCandies.has(candy)) {
          knownCandies = knownCandies.add(candy);
          sendWS(session.networking.socket)("host-ice-candidate", { candidate: candidate.toJSON() });
        }
      }
    };

  connection.oniceconnectionstatechange = () => {
    if (connection.iceConnectionState == "disconnected") {
      cleanupSession(joinerID);
    }
  };

  connection.setRemoteDescription(offer)
    .then(()     => connection.createAnswer())
    .then(answer => connection.setLocalDescription(answer))
    .then(()     => sendWS(session.networking.socket)("host-answer", { answer: connection.localDescription }));

};

// (RTCPeerConnection, String, String, String) => (Any) => Unit
const handleConnectionMessage = (connection, nlogo, sessionName, joinerID) => ({ data }) => {
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

// (Protocol.Channel, String, String, String) => (Any) => Unit
const handleChannelMessages = (channel, nlogo, sessionName, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {

    case "connection-established":
      break;

    case "login":
      handleLogin(channel, nlogo, sessionName, datum, joinerID);
      break;

    case "pong":

      const sesh         = sessions[joinerID];
      const pingBucket   = sesh.pingData[datum.id];
      pingBucket.endTime = performance.now();
      const pingTime     = pingBucket.endTime - pingBucket.startTime;

      sendRTC(channel)("ping-result", { time: Math.floor(pingTime) }, true);

      if (sesh.recentPings === undefined) {
        sesh.recentPings = [pingTime];
      } else {
        sesh.recentPings.push(pingTime);
        if (sesh.recentPings.length > 5) {
          sesh.recentPings.shift();
        };
      }

      const averagePing = Math.round(sesh.recentPings.reduce((x, y) => x + y) / sesh.recentPings.length);

      document.querySelector('#nlw-frame > iframe').contentWindow.postMessage({
        type:    "hnw-latest-ping"
      , ping:    pingTime
      , joinerID
      }, "*");

      break;

    case "relay":
      const babyDearest = document.getElementById("nlw-frame").querySelector('iframe').contentWindow;
      babyDearest.postMessage(datum.payload, "*");
      break;

    case "bye-bye":
      sessions[joinerID].networking.channel.close();
      delete sessions[joinerID];
      break;

    default:
      console.warn(`Unknown WebSocket event type: ${datum.type}`);

  }
};

// (String) => () => Unit
const handleChannelClose = (joinerID) => () => {
  const babyDearest = document.getElementById( "nlw-frame").querySelector('iframe').contentWindow;
  babyDearest.postMessage({ joinerID, type: "hnw-notify-disconnect" }, "*");
  cleanupSession(joinerID);
};

// (RTCDataChannel, String, String, { username :: String, password :: String }, String) => Unit
const handleLogin = (channel, nlogo, sessionName, datum, joinerID) => {

  if (datum.username !== undefined) {

    const joinerUsername  = datum.username.toLowerCase();
    const relevantPairs   = Object.entries(sessions).filter(([k, s]) => k !== joinerID && s.username !== undefined);
    const usernameIsTaken = relevantPairs.some(([k, s]) => s.username.toLowerCase() === joinerUsername);

    if (!usernameIsTaken) {
      if (password === null || password === datum.password) {

        sessions[joinerID].networking.socket.close();
        sessions[joinerID].username      = datum.username;
        sessions[joinerID].isInitialized = false;
        sendRTC(channel)("login-successful", {});

        const babyDearest = document.getElementById("nlw-frame").querySelector('iframe').contentWindow;
        babyDearest.postMessage({
          type:     "hnw-request-initial-state"
        , token:    joinerID
        , roleName: "student"
        , username: sessions[joinerID].username
        }, "*");

      } else {
        sendRTC(channel)("incorrect-password", {});
        // TODO: We also need to close the channel in all of these cases
      }
    } else {
      sendRTC(channel)("username-already-taken", {});
    }

  } else {
    sendRTC(channel)("no-username-given", {});
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
    const sesh   = sessions[recipientUUID];
    const isOpen = (channel) => channel.readyState === "open" || channel.readyState === networking.status.open;
    if (sesh !== undefined && sesh.networking.channel !== undefined && isOpen(sesh.networking.channel))
      sendBurst(sesh.networking.channel)(type, message);
  }

  const broadcast = (type, message) => {
    const checkIsEligible = (s) => {
      let nw = s.networking;
      return nw.channel !== undefined && nw.channel.readyState === HNWRTC.status.open && s.hasInitialized;
    };
    const channels = Object.values(sessions).filter(checkIsEligible).map((s) => s.networking.channel);
    sendBurst(...channels)(type, message);
  }

  switch (data.type) {
    case "nlw-state-update":
      if (data.isNarrowcast)
        narrowcast("here-have-an-update", { update: data.update }, data.recipient);
      else
        broadcast("here-have-an-update", { update: data.update });
      break;
    case "nlw-view":
      if (lastImageUpdate !== data.base64) {
        lastImageUpdate = data.base64;
        sendWS(statusSocket)("image-update", { base64: data.base64 });
      }
      break;
    case "hnw-initial-state":
      const { token, role, state, viewState } = data;
      narrowcast("here-have-a-model", { role, token, state, view: viewState }, token);
      sessions[token].hasInitialized = true;
      break;
    case "relay":
      if (data.isNarrowcast) {
        const parcel = Object.assign({}, data)
        delete parcel.isNarrowcast;
        delete parcel.recipient;
        narrowcast("relay", parcel, data.recipient);
      } else {
        broadcast("relay", data);
      }
      break;
    case "hnw-fatal-error":
      alert(`Fatal error received from client: ${data.subtype}`);
      window.location.reload()
      break;
    case "nlw-resize":
      break;
    default:
      console.warn(`Unknown postMessage type: ${data.type}`);
  }

});

window.addEventListener("beforeunload", (event) => {
  // Honestly, this will probably not run before the tab closes.  Not much I can do about that.  --JAB (8/21/20)
  Object.entries(sessions).forEach(([joinerID, { networking: { channel } }]) => {
    sendRTC(channel)("bye-bye");
    channel.close(1000, "Terminating unneeded sockets...");
  });
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

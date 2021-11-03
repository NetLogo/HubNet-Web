import { awaitWorker, byteSizeLabel, HNWProtocolVersionNumber
       , uuidToRTCID } from "./common.js";

import { reportBandwidth, reportNewSend      } from "./bandwidth-monitor.js";
import { decoderPool, encoderPool, sendBurst } from "./compress.js";
import { genNextID                           } from "./id-manager.js";
import { hostConfig                          } from "./webrtc.js";

import * as CompressJS from "./compress.js";

const sendGreeting = CompressJS.sendGreeting(true);
const sendRTC      = CompressJS.sendRTC     (true);

// type Session = {
//   networking :: { socket     :: WebSocket
//                 , connection :: RTCPeerConnection
//                 , channel    :: RTCDataChannel
//                 }
// , hasInitialized :: Boolean
// , username       :: String
// , pingData       :: { [pingID] :: Number }
// , recentPings    :: Array[Number]
// , recentBuffer   :: Array[Number]
// }

const sessions = {}; // Object[Session]

let password = null; // String

const SigTerm = "signaling-terminated";

const broadSocketW = new Worker("js/broadsocket.js", { type: "module" });

const statusSocketW = new Worker("js/status-socket.js", { type: "module" });

// (DOMElement) => Boolean
self.submitLaunchForm = (elem) => {

  const formData = new FormData(elem);
  const lm       = formData.get("libraryModel").slice(4);

  launchModel({ "modelType":   "library"
              , "sessionName": formData.get("sessionName")
              , "password":    formData.get("password")
              , "model":       lm
              });

  return true;

};

// (Object[String]) => Unit
const launchModel = (formDataPlus) => {

  if (formDataPlus.password === "")
    delete formDataPlus.password;
  else
    password = formDataPlus.password;

  new Promise(
    (resolve) => {

      if (formDataPlus.model instanceof File) {
        const reader = new FileReader();
        reader.onloadend = (event) => {
          resolve([formDataPlus, event.target]);
        };
        reader.readAsText(formDataPlus.model);
      } else {
        resolve([formDataPlus, formDataPlus.model]);
      }

    }
  ).then(([fdp, fileEvent]) => {
    const modelUpdate =
      fileEvent.result !== undefined ? { model: fileEvent.result } : {};
    return { ...fdp, ...modelUpdate };
  }).then((fddp) => {

    const data =
      { method:  "POST"
      , headers: { "Content-Type": "application/json" }
      , body:    JSON.stringify(fddp)
      };

    return fetch("/x-launch-session", data).then((response) => [fddp, response]);

  }).then(([formDataLike, response]) => {

    if (response.status === 200) {

      response.json().then(({ id: hostID, type, nlogoMaybe, jsonMaybe }) => {

        document.getElementById("id-display").innerText = hostID;

        const canDealWith = type === "from-library" || type === "from-upload";
        const nlogo       = canDealWith ? nlogoMaybe            : "what is this model type?!";
        const json        = canDealWith ? JSON.parse(jsonMaybe) : "get wrecked";
        const sessionName = formDataLike.sessionName;

        const formFrame = document.getElementById("form-frame");
        const  nlwFrame = document.getElementById( "nlw-frame");

        formFrame.classList.add(  "hidden");
        nlwFrame .classList.remove("invis");
        history.pushState({ name: "hosting" }, "hosting");

        postToNLW({ ...json, type: "hnw-become-oracle", nlogo });
        postToNLW({          type: "nlw-subscribe-to-updates", uuid: hostID });

        broadSocketW.onmessage = ({ data }) => {
          switch (data.type) {

            case "hello":

              const joinerID   = data.joinerID;
              const connection = new RTCPeerConnection(hostConfig);

              const signaling     = new Worker("js/host-signaling-socket.js", { type: "module" });
              signaling.onmessage = handleConnectionMessage(connection, nlogo, sessionName, joinerID);

              const signalingURL = `ws://localhost:8080/rtc/${hostID}/${joinerID}/host`;
              signaling.postMessage({ type: "connect", url: signalingURL });

              sessions[joinerID] = { networking:     { signaling }
                                   , hasInitialized: false
                                   , pingData:       {}
                                   , recentPings:    []
                                   , recentBuffer:   []
                                   };

              encoderPool.postMessage({ type: "client-connect" });
              decoderPool.postMessage({ type: "client-connect" });

              break;

            default:
              console.warn(`Unknown broad event type: ${data.type}`);

          }
        };

        const broadSocketURL = `ws://localhost:8080/rtc/${hostID}`;
        broadSocketW.postMessage({ type: "connect", url: broadSocketURL });

        const statusSocketURL = `ws://localhost:8080/hnw/my-status/${hostID}`;
        statusSocketW.postMessage({ type: "connect", url: statusSocketURL });

        setInterval(() => {
          const channels = Object.values(sessions).map((session) => session.networking.channel);
          channels.forEach((channel) => sendRTC(channel)("keep-alive", {}));
        }, 30000);

        setInterval(() => {
          const nameIsDefined = (s) => s.username !== undefined;
          const numPeers      = Object.values(sessions).filter(nameIsDefined).length;
          statusSocketW.postMessage({ type: "members-update", numPeers });
        }, 1000);

        setInterval(updateCongestionStats, 1000);

        setInterval(updateBandwidthLabel, 500);

        setInterval(() => {
          Object.values(sessions).forEach((session) => {
            const channel = session.networking.channel;
            if (channel !== undefined) {
              const idType         = `${channel.label}-${channel.id}-ping`;
              const id             = genNextID(idType);
              session.pingData[id] = performance.now();
              const lastIndex      = session.recentPings.length - 1;
              const lastPing       = session.recentPings[lastIndex];
              sendRTC(channel)("ping", { id, lastPing });
            }
          });
        }, 2000);

        setInterval(() => {
          postToNLW({ type: "nlw-request-view" });
        }, 8000);

      });

    } else {
      response.text().then((body) => { alert(JSON.stringify(body)); });
    }

  });

};

// (RTCPeerConnection, String, String, String) => (RTCSessionDescription) => Unit
const processOffer = (connection, nlogo, sessionName, joinerID) => (offer) => {

  const rtcID       = uuidToRTCID(joinerID);
  const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
  channel.onopen    = () => { sendGreeting(channel); };
  channel.onmessage = handleChannelMessages(channel, nlogo, sessionName, joinerID);
  channel.onclose   = () => { cleanUpJoiner(joinerID); };

  const session = sessions[joinerID];

  session.networking.connection = connection;
  session.networking.channel    = channel;

  // (String, Object[Any]) => Unit
  const signal =
    (type, parcel) => {
      const signaling = session.networking.signaling;
      if (signaling !== SigTerm) {
        signaling.postMessage({ type, ...parcel });
      }
    };

  let knownCandies = new Set([]);

  connection.onicecandidate =
    ({ candidate }) => {
      if (candidate !== undefined && candidate !== null) {
        const candy    = candidate.toJSON();
        const candyStr = JSON.stringify(candy);
        if (!knownCandies.has(candyStr)) {
          knownCandies = knownCandies.add(candyStr);
          signal("ice-candidate", { candidate: candy });
        }
      }
    };

  connection.oniceconnectionstatechange = () => {
    if (connection.iceConnectionState == "disconnected") {
      cleanUpJoiner(joinerID);
    }
  };

  connection.setRemoteDescription(offer)
    .then(()     => connection.createAnswer())
    .then(answer => connection.setLocalDescription(answer))
    .then(()     => signal("answer", { answer: connection.localDescription.toJSON() }));

};

// (RTCPeerConnection, String, String, String) => (Object[Any]) => Unit
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

  const dataArr = new Uint8Array(data);

  new Promise(
    (resolve) => {

      const chan = new MessageChannel();

      chan.port1.onmessage = ({ data }) => {
        chan.port1.close();
        resolve(data);
      };

      decoderPool.postMessage({ type: "decode", parcel: dataArr }, [chan.port2]);

    }
  ).then((datum) => {

    switch (datum.type) {

      case "connection-established":

        if (datum.protocolVersion !== HNWProtocolVersionNumber) {
          const id = sessions[joinerID] && sessions[joinerID].username || joinerID;
          alert(`HubNet protocol version mismatch!  You are using protocol version '${HNWProtocolVersionNumber}', while client '${id}' is using version '${datum.v}'.  To ensure that you and the client are using the same version of HubNet Web, all parties should clear their browser cache and try connecting again.  The offending client has been disconnected.`);
          sessions[joinerID].networking.channel.close();
          delete sessions[joinerID];
        }

        break;

      case "login":
        handleLogin(channel, nlogo, sessionName, datum, joinerID);
        break;

      case "pong":

        const sesh       = sessions[joinerID];
        const pingBucket = sesh.pingData[datum.id];
        const pingTime   = performance.now() - pingBucket;
        delete pingBucket[datum.id];

        sesh.recentPings.push(pingTime);
        if (sesh.recentPings.length > 5) {
          sesh.recentPings.shift();
        }

        const latestPing =
          { type: "hnw-latest-ping"
          , ping: pingTime
          , joinerID
          };

        postToNLW(latestPing);

        break;

      case "relay":
        postToNLW(datum.payload);
        break;

      case "bye-bye":
        cleanUpJoiner(joinerID);
        break;

      default:
        console.warn(`Unknown channel event type: ${datum.type}`);

    }

  });

};

// (String) => () => Unit
const cleanUpJoiner = (joinerID) => {
  postToNLW              ({ type: "hnw-notify-disconnect", joinerID });
  encoderPool.postMessage({ type: "client-disconnect" });
  decoderPool.postMessage({ type: "client-disconnect" });
  delete sessions[joinerID];
};

// (RTCDataChannel, String, String, { username :: String, password :: String }, String) => Unit
const handleLogin = (channel, nlogo, sessionName, datum, joinerID) => {

  if (datum.username !== undefined) {

    const isRelevant = ([k, s]) => k !== joinerID && s.username !== undefined;
    const isTaken    = ([ , s]) => s.username.toLowerCase() === joinerUsername;

    const joinerUsername  = datum.username.toLowerCase();
    const relevantPairs   = Object.entries(sessions).filter(isRelevant);
    const usernameIsTaken = relevantPairs.some(isTaken);

    if (!usernameIsTaken) {
      if (password === null || password === datum.password) {

        const session = sessions[joinerID];

        session.networking.signaling.terminate();
        session.networking.signaling = SigTerm;

        session.username      = datum.username;
        session.isInitialized = false;
        sendRTC(channel)("login-successful", {});

        const requestInitState =
          { type:     "hnw-request-initial-state"
          , token:    joinerID
          , roleName: "student"
          , username: sessions[joinerID].username
          };

        postToNLW(requestInitState);

      } else {
        sendRTC(channel)("incorrect-password", {});
      }
    } else {
      sendRTC(channel)("username-already-taken", {});
    }

  } else {
    sendRTC(channel)("no-username-given", {});
  }

};

// () => Unit
const cleanupHostingSession = () => {
  location.reload();
};

self.addEventListener("message", ({ data }) => {

  const narrowcast = (type, message, recipientUUID) => {
    if (sessions[recipientUUID]?.networking.channel?.readyState === "open") {
      sendBurst(true, sessions[recipientUUID].networking.channel)(type, message);
    }
  };

  const broadcast = (type, message) => {
    const checkIsEligible = (s) => {
      const nw         = s.networking;
      const hasChannel = nw.channel !== undefined;
      return hasChannel && nw.channel.readyState === "open" && s.hasInitialized;
    };
    const toChannel = (s) => s.networking.channel;
    const channels  = Object.values(sessions).filter(checkIsEligible).map(toChannel);
    sendBurst(true, ...channels)(type, message);
  };

  switch (data.type) {
    case "nlw-state-update":
      if (data.isNarrowcast)
        narrowcast("state-update", { update: data.update }, data.recipient);
      else
        broadcast("state-update", { update: data.update });
      break;
    case "nlw-view":
      statusSocketW.postMessage({ type: "image-update", blob: data.blob });
      break;
    case "galapagos-direct-launch":
      const { nlogo, config, sessionName, password } = data;
      launchModel({ modelType:  "upload"
                  , model:       nlogo
                  , sessionName
                  , password
                  , config
                  });
      break;
    case "hnw-initial-state":
      const { token, role, state, viewState } = data;
      narrowcast("initial-model", { role, token, state, view: viewState }, token);
      sessions[token].hasInitialized = true;
      break;
    case "relay":
      if (data.isNarrowcast) {
        const parcel = Object.assign({}, data);
        delete parcel.isNarrowcast;
        delete parcel.recipient;
        narrowcast("relay", parcel, data.recipient);
      } else {
        broadcast("relay", data);
      }
      break;
    case "hnw-fatal-error":
      alert(`Fatal error received from client: ${data.subtype}`);
      self.location.reload();
      break;
    case "nlw-resize":
      break;
    default:
      console.warn(`Unknown postMessage type: ${data.type}`);
  }

});

self.addEventListener("beforeunload", () => {
  // Honestly, this will probably not run before the tab closes.  Not much I can do about that.  --JAB (8/21/20)
  Object.entries(sessions).forEach(([ , { networking: { channel } }]) => {
    sendRTC(channel)("bye-bye");
    channel.close(1000, "Terminating unneeded sockets...");
  });
});

self.addEventListener("popstate", (event) => {
  switch (event.state.name) {
    case "hosting":
      cleanupHostingSession();
    default:
      console.warn(`Unknown state: ${event.state.name}`);
  }
});

// () => Unit
const updateBandwidthLabel = () => {

  const syncNewSend = reportNewSend();

  const syncBandwidth = reportBandwidth();

  const signalers     = Object.values(sessions).map((s) => s.networking.signaling);
  const trueSignalers = signalers.filter((x) => x !== SigTerm);

  const parcel        = { type: "request-bandwidth-report" };
  const workers       = [broadSocketW, statusSocketW].concat(trueSignalers);
  const promises      = workers.map((w) => awaitWorker(w, parcel));

  Promise.all(promises).then(
    (results) => {
      const asyncBandwidth = results.reduce(((acc, x) => acc + x), 0);
      const newText        = byteSizeLabel(syncBandwidth + asyncBandwidth, 2);
      document.getElementById("bandwidth-span").innerText = newText;
    }
  );

  const newSendParcel   = { type: "request-new-send" };
  const newSendPromises = workers.map((w) => awaitWorker(w, newSendParcel));

  Promise.all(newSendPromises).then(
    (results) => {
      const asyncNewSend = results.reduce(((acc, x) => acc + x), 0);
      const newText      = byteSizeLabel(syncNewSend + asyncNewSend, 2);
      document.getElementById("new-send-span").innerText = newText;
    }
  );

};

let congestionDuration = 0;

// () => Unit
const updateCongestionStats = () => {

  Object.values(sessions).filter((s) => s.channel !== undefined).forEach(
    (s) => {
      const bufferLog = s.recentBuffer;
      bufferLog.push(s.networking.channel.bufferedAmount);
      if (bufferLog.length > 8) {
        bufferLog.shift();
      }
    }
  );

  const numClients = Object.keys(sessions).length;

  const numCongested =
    Object.values(sessions).filter(
      (s) => s.recentBuffer.filter((x) => x > 20000).length >= 5
    ).length;

  const allGoodStatus         = "All connections are uncongested";
  const minorCongestionStatus = `There is congestion for ${numCongested} client(s)`;
  const majorCongestionStatus = `There is congestion for ${numCongested} client(s); slowing simulation so they can catch up`;

  const connectionIsCongested = numCongested >= (numClients / 3);

  const status =
    (numCongested === 0)    ? allGoodStatus :
      connectionIsCongested ? minorCongestionStatus :
                              majorCongestionStatus;

  if (connectionIsCongested) {
    postToNLW({ type: "hnw-notify-congested" });
    congestionDuration++;
  } else {
    if (congestionDuration > 0) {
      postToNLW({ type: "hnw-notify-uncongested" });
    }
    congestionDuration = 0;
  }

  const setText =
    (id, text) => {
      document.getElementById(id).innerText = text;
    };

  setText("num-clients-span"    ,   numClients);
  setText("num-congested-span"  , numCongested);
  setText("activity-status-span",       status);

};

// (Object[Any]) => Unit
const postToNLW = (msg) => {
  document.querySelector("#nlw-frame > iframe").contentWindow.postMessage(msg, "*");
};

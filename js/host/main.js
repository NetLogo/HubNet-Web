import { awaitDeserializer, notifyDeserializer, notifySerializer } from "/js/serialize/pool-party.js";

import { awaitWorker               } from "/js/common/await.js";
import { hnw                       } from "/js/common/domain.js";
import { ProtoVersion, uuidToRTCID } from "/js/common/util.js";

import { rtcConfig } from "./webrtc.js";

import BandwidthManager from "./ui/bandwidth-manager.js";
import NLWManager       from "./ui/nlw-manager.js";

import IDManager from "/js/common/id-manager.js";

import * as WebRTCJS from "/js/common/webrtc.js";

const sendGreeting = WebRTCJS.sendGreeting(true);
const sendRTC      = WebRTCJS.sendRTC     (true);

// type Session = {
//   networking :: { socket     :: WebSocket
//                 , connection :: RTCPeerConnection
//                 , channel    :: RTCDataChannel
//                 }
// , hasInitialized :: Boolean
// , username       :: String
// , pingData       :: { [pingID] :: Number }
// , recentPings    :: Array[Number]
// }

const sessions = {}; // Object[Session]

let password = null; // String

const SigTerm = "signaling-terminated"; // String

const broadSocketW = new Worker("js/host/ws/broadsocket.js", { type: "module" });

const statusSocketW = new Worker("js/host/ws/status-socket.js", { type: "module" });

document.getElementById("launch-form").addEventListener("submit", (e) => {

  const formData = new FormData(e.target);
  const lm       = formData.get("libraryModel").slice(4);

  launchModel({ "modelType":   "library"
              , "sessionName": formData.get("sessionName")
              , "password":    formData.get("password")
              , "model":       lm
              });

  return true;

});

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

const onNLWManError = (subtype) => {
  alert(`Fatal error received from client: ${subtype}`);
  self.location.reload();
};

// (UUID, Boolean?) => RTCDataChannel?
const getOpenChannelByID = (uuid, allowUninited = false) => {
  const session = sessions[uuid];
  if (session !== undefined && (allowUninited || session.hasInitialized) &&
      session.networking.channel?.readyState === "open") {
    return session.networking.channel;
  } else {
    return null;
  }
};

// () => Array[RTCDataChannel]
const getOpenChannels = () => {
  return Object.keys(sessions).map(getOpenChannelByID).filter((c) => c !== null);
};

// (Blob) => Unit
const postImageUpdate = (blob) => {
  statusSocketW.postMessage({ type: "image-update", blob });
};

// (UUID) => Unit
const initSesh = (uuid) => {
  if (sessions[uuid] !== undefined) {
    sessions[uuid].hasInitialized = true;
  }
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

    return fetch("/launch-session", data).then((response) => [fddp, response]);

  }).then(([formDataLike, response]) => {

    if (response.status === 200) {

      response.json().then(({ id: hostID, type, nlogoMaybe, jsonMaybe }) => {

        document.getElementById("id-display").innerText = hostID;

        const canDealWith = type === "from-library" || type === "from-upload";
        const nlogo       = canDealWith ? nlogoMaybe            : "what is this model type?!";
        const json        = canDealWith ? JSON.parse(jsonMaybe) : "get wrecked";
        const sessionName = formDataLike.sessionName;

        const formFrame = document.getElementById("form-frame");

        history.pushState({ name: "hosting" }, "hosting");

        formFrame.classList.add("hidden");

        nlwManager.show();
        nlwManager.post({ ...json, type: "hnw-become-oracle", nlogo });
        nlwManager.post({ type: "nlw-subscribe-to-updates", uuid: hostID });

        broadSocketW.onmessage = ({ data }) => {
          switch (data.type) {

            case "hello": {

              const joinerID   = data.joinerID;
              const connection = new RTCPeerConnection(rtcConfig);

              const signaling     = new Worker("js/host/ws/signaling-socket.js", { type: "module" });
              signaling.onmessage = handleConnectionMessage(connection, nlogo, sessionName, joinerID);

              const signalingURL = `ws://${hnw}/rtc/${hostID}/${joinerID}/host`;
              signaling.postMessage({ type: "connect", url: signalingURL });

              sessions[joinerID] = { networking:     { signaling }
                                   , hasInitialized: false
                                   , pingData:       {}
                                   , recentPings:    []
                                   };

              notifySerializer  ("client-connect");
              notifyDeserializer("client-connect");

              break;

            }

            default: {
              console.warn(`Unknown broad event type: ${data.type}`);
            }

          }
        };

        const broadSocketURL = `ws://${hnw}/rtc/${hostID}`;
        broadSocketW.postMessage({ type: "connect", url: broadSocketURL });

        const statusSocketURL = `ws://${hnw}/hnw/my-status/${hostID}`;
        statusSocketW.postMessage({ type: "connect", url: statusSocketURL });

        const awaitSenders = (msg) => {
          const seshes        = Object.values(sessions);
          const signalers     = seshes.map((s) => s.networking.signaling);
          const trueSignalers = signalers.filter((x) => x !== SigTerm);
          const workers       = [broadSocketW, statusSocketW].concat(trueSignalers);
          const promises      = workers.map((w) => awaitWorker(w)(msg));
          return Promise.all(promises);
        };

        setInterval(() => {

          const channels =
            Object.
              values(sessions).
              map((session) => session.networking.channel).
              filter((channel) => channel !== undefined);

          channels.forEach((channel) => sendRTC(channel)("keep-alive", {}));

        }, 30000);

        setInterval(() => {
          const nameIsDefined = (s) => s.username !== undefined;
          const numPeers      = Object.values(sessions).filter(nameIsDefined).length;
          statusSocketW.postMessage({ type: "members-update", numPeers });
        }, 1000);

        setInterval(() => {
          const pairs    = Object.entries(sessions);
          const nada     = undefined;
          const filtered = pairs.filter(([  , s]) => s.networking.channel !== nada);
          const entries  = filtered.map(([id, s]) => [id, s.networking.channel]);
          bandwidthManager.updateCongestionStats(Object.fromEntries(entries));
        }, 1000);

        setInterval(() => { bandwidthManager.updateBandwidth(awaitSenders); }, 500);

        setInterval(() => {

          const idManager = new IDManager();

          Object.values(sessions).forEach((session) => {
            const channel = session.networking.channel;
            if (channel !== undefined) {
              const idType         = `${channel.label}-${channel.id}-ping`;
              const id             = idManager.next(idType);
              session.pingData[id] = performance.now();
              const lastIndex      = session.recentPings.length - 1;
              const lastPing       = session.recentPings[lastIndex];
              sendRTC(channel)("ping", { id, lastPing });
            }
          });

        }, 2000);

        setInterval(() => {
          nlwManager.post({ type: "nlw-request-view" });
        }, 8000);

      });

    } else {
      response.text().then((body) => { alert(JSON.stringify(body)); });
    }

  });

};

const nlwManager =
  new NLWManager( byEID("nlw-frame"), launchModel, initSesh, getOpenChannelByID
                , getOpenChannels, postImageUpdate, onNLWManError);

document.addEventListener("DOMContentLoaded", nlwManager.init);

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
    if (connection.iceConnectionState === "disconnected") {
      cleanUpJoiner(joinerID);
    }
  };

  connection.setRemoteDescription(offer).
    then(()     => connection.createAnswer()).
    then(answer => connection.setLocalDescription(answer)).
    then(()     => signal("answer", { answer: connection.localDescription.toJSON() }));

};

// (RTCPeerConnection, String, String, String) => (Object[Any]) => Unit
const handleConnectionMessage = (connection, nlogo, sessionName, joinerID) => ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "joiner-offer": {
      processOffer(connection, nlogo, sessionName, joinerID)(datum.offer);
      break;
    }
    case "joiner-ice-candidate": {
      connection.addIceCandidate(datum.candidate);
      break;
    }
    case "bye-bye":
    case "keep-alive": {
      break;
    }
    default: {
      console.warn(`Unknown narrow event type: ${datum.type}`);
    }
  }
};

// (Protocol.Channel, String, String, String) => (Any) => Unit
const handleChannelMessages = (channel, nlogo, sessionName, joinerID) => ({ data }) => {

  const message = { parcel: new Uint8Array(data) };

  awaitDeserializer("deserialize", message).then((datum) => {

    switch (datum.type) {

      case "connection-established": {

        if (datum.protocolVersion !== ProtoVersion) {
          const id = sessions[joinerID] && sessions[joinerID].username || joinerID;
          alert(`HubNet protocol version mismatch!  You are using protocol version '${ProtoVersion}', while client '${id}' is using version '${datum.v}'.  To ensure that you and the client are using the same version of HubNet Web, all parties should clear their browser cache and try connecting again.  The offending client has been disconnected.`);
          sessions[joinerID].networking.channel.close();
          delete sessions[joinerID];
        }

        break;

      }

      case "login": {
        handleLogin(channel, nlogo, sessionName, datum, joinerID);
        break;
      }

      case "pong": {

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

        nlwManager.post(latestPing);

        break;

      }

      case "relay": {
        nlwManager.post(datum.payload);
        break;
      }

      case "bye-bye": {
        cleanUpJoiner(joinerID);
        break;
      }

      default: {
        console.warn(`Unknown channel event type: ${datum.type}`);
      }

    }

  });

};

// (String) => () => Unit
const cleanUpJoiner = (joinerID) => {
  nlwManager.post({ type: "hnw-notify-disconnect", joinerID });
  notifySerializer  ("client-disconnect");
  notifyDeserializer("client-disconnect");
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

        session.username = datum.username;
        sendRTC(channel)("login-successful", {});

        const requestInitState =
          { type:     "hnw-request-initial-state"
          , token:    joinerID
          , roleName: "student"
          , username: sessions[joinerID].username
          };

        nlwManager.post(requestInitState);

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

// (String) => (String) => Unit
const setIT = (id) => (text) => {
  byEID(id).innerText = text;
};

// (String) => () => Unit
const genNotifyNLW = (type) => () => {
  nlwManager.post({ type });
};

const bandwidthManager =
    new BandwidthManager( setIT("bandwidth-span"), setIT("new-send-span")
                        , setIT("num-clients-span"), setIT("num-congested-span")
                        , setIT("activity-status-span")
                        , genNotifyNLW("hnw-notify-congested")
                        , genNotifyNLW("hnw-notify-uncongested"));

self.addEventListener("beforeunload", () => {
  // Honestly, this will probably not run before the tab closes.
  // Not much I can do about that.  --Jason B. (8/21/20)
  Object.entries(sessions).forEach(([ , { networking: { channel } }]) => {
    sendRTC(channel)("bye-bye");
    channel.close(1000, "Terminating unneeded sockets...");
  });
});

self.addEventListener("popstate", (event) => {
  switch (event.state.name) {
    case "hosting": {
      cleanupHostingSession();
      break;
    }
    default: {
      console.warn(`Unknown state: ${event.state.name}`);
    }
  }
});

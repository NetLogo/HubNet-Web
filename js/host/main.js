import { uuidToRTCID } from "/js/common/util.js";

import { awaitDeserializer, notifyDeserializer, notifySerializer } from "/js/serialize/pool-party.js";

import { version } from "/js/static/version.js";

import BandwidthManager     from "./ui/bandwidth-manager.js";
import LaunchControlManager from "./ui/launch-control-manager.js";
import NLWManager           from "./ui/nlw-manager.js";

import BroadSocket  from "./ws/broadsocket.js";
import StatusSocket from "./ws/status-socket.js";

import IDManager  from "/js/common/id-manager.js";
import RTCManager from "/js/common/rtc-manager.js";

const rtcManager = new RTCManager(true);

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

const broadSocket  = new BroadSocket();
const statusSocket = new StatusSocket();

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

// (UUID) => Unit
const initSesh = (uuid) => {
  if (sessions[uuid] !== undefined) {
    sessions[uuid].hasInitialized = true;
  }
};

// (Object[Any]) => Unit
const finishLaunch = ({ isSuccess, data }) => {

  if (isSuccess) {

    const { hostID, json, nlogo, sessionName } = data;

    document.getElementById("id-display").innerText = hostID;

    history.pushState({ name: "hosting" }, "hosting");

    nlwManager.show();
    nlwManager.becomeOracle(hostID, json, nlogo);

    const hcm = (c, id) => handleConnectionMessage(c, nlogo, sessionName, id);

    const registerSignaling = (signaling, joinerID) => {

      sessions[joinerID] = { networking:     { signaling }
                           , hasInitialized: false
                           , pingData:       {}
                           , recentPings:    []
                           };

      notifySerializer  ("client-connect");
      notifyDeserializer("client-connect");

    };

     broadSocket.connect(hostID, hcm, registerSignaling);
    statusSocket.connect(hostID);

    const awaitSenders = (msg) => {
      const seshes        = Object.values(sessions);
      const signalers     = seshes.map((s) => s.networking.signaling);
      const unterminateds = signalers.filter((s) => !s.isTerminated());
      const awaitables    = [broadSocket, statusSocket].concat(unterminateds);
      const promises      = awaitables.map((s) => s.await(msg));
      return Promise.all(promises);
    };

    setInterval(() => {

      const channels =
        Object.
          values(sessions).
          map((session) => session.networking.channel).
          filter((channel) => channel !== undefined);

      channels.forEach((channel) => rtcManager.send(channel)("keep-alive", {}));

    }, 30000);

    setInterval(() => {
      const nameIsDefined = (s) => s.username !== undefined;
      const numPeers      = Object.values(sessions).filter(nameIsDefined).length;
      statusSocket.updateNumPeers(numPeers);
    }, 1000);

    setInterval(() => {
      const pairs    = Object.entries(sessions);
      const nada     = undefined;
      const filtered = pairs.filter(([  , s]) => s.networking.channel !== nada);
      const entries  = filtered.map(([id, s]) => [id, s.networking.channel]);
      bandwidthManager.updateCongestionStats(Object.fromEntries(entries));
    }, 1000);

    setInterval(() => {
      const bandwidth = rtcManager.getBandwidth();
      const newSend   = rtcManager.getNewSend();
      bandwidthManager.updateBandwidth(awaitSenders, bandwidth, newSend);
    }, 500);

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
          rtcManager.send(channel)("ping", { id, lastPing });
        }
      });

    }, 2000);

    setInterval(() => {
      nlwManager.updatePreview();
    }, 8000);

  }

};

const launchModel = (model) => {
  launchControlManager.launch(model).
    then(finishLaunch);
};

const awaitLaunchHTTP = (data) => fetch("/launch-session", data);
const notifyUser      = (s) => { alert(s); };

const launchControlManager =
  new LaunchControlManager( byEID("form-frame"), awaitLaunchHTTP, notifyUser
                          , finishLaunch);

const nlwManager =
  new NLWManager( byEID("nlw-frame"), rtcManager, launchModel, initSesh
                , getOpenChannelByID, getOpenChannels, statusSocket.postImageUpdate
                , onNLWManError);

document.addEventListener("DOMContentLoaded", nlwManager.init);

// (RTCPeerConnection, String, String, String) => (RTCSessionDescription) => Unit
const processOffer = (connection, nlogo, sessionName, joinerID) => (offer) => {

  const rtcID       = uuidToRTCID(joinerID);
  const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
  channel.onopen    = () => { rtcManager.sendGreeting(channel); };
  channel.onmessage = handleChannelMessages(channel, nlogo, sessionName, joinerID);
  channel.onclose   = () => { cleanUpJoiner(joinerID); };

  const session = sessions[joinerID];

  session.networking.connection = connection;
  session.networking.channel    = channel;

  let knownCandies = new Set([]);

  connection.onicecandidate =
    ({ candidate }) => {
      if (candidate !== undefined && candidate !== null) {
        const candy    = candidate.toJSON();
        const candyStr = JSON.stringify(candy);
        if (!knownCandies.has(candyStr)) {

          knownCandies = knownCandies.add(candyStr);

          const signaling = session.networking.signaling;
          if (!signaling.isTerminated()) {
            signaling.sendICECandidate(candy);
          }

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
    then(()     => {
      const signaling = session.networking.signaling;
      if (!signaling.isTerminated()) {
        signaling.sendAnswer(connection.localDescription.toJSON());
      }
    });


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

        if (datum.protocolVersion !== version) {
          const id = sessions[joinerID] && sessions[joinerID].username || joinerID;
          alert(`HubNet protocol version mismatch!  You are using protocol version '${version}', while client '${id}' is using version '${datum.v}'.  To ensure that you and the client are using the same version of HubNet Web, all parties should clear their browser cache and try connecting again.  The offending client has been disconnected.`);
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

        nlwManager.registerPing(joinerID, pingTime);

        break;

      }

      case "relay": {
        nlwManager.relay(datum.payload);
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
  nlwManager.disown(joinerID);
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
      if (launchControlManager.passwordMatches(datum.password)) {

        const session = sessions[joinerID];

        session.networking.signaling.terminate();

        session.username = datum.username;
        rtcManager.send(channel)("login-successful", {});

        nlwManager.initializeJoiner(joinerID, sessions[joinerID].username);

      } else {
        rtcManager.send(channel)("incorrect-password", {});
      }
    } else {
      rtcManager.send(channel)("username-already-taken", {});
    }

  } else {
    rtcManager.send(channel)("no-username-given", {});
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

const bandwidthManager =
    new BandwidthManager( setIT("bandwidth-span"), setIT("new-send-span")
                        , setIT("num-clients-span"), setIT("num-congested-span")
                        , setIT("activity-status-span")
                        , nlwManager.notifyCongested, nlwManager.notifyUncongested);

self.addEventListener("beforeunload", () => {
  // Honestly, this will probably not run before the tab closes.
  // Not much I can do about that.  --Jason B. (8/21/20)
  Object.entries(sessions).forEach(([ , { networking: { channel } }]) => {
    rtcManager.send(channel)("bye-bye");
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

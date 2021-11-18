import { uuidToRTCID } from "/js/common/util.js";

import { awaitDeserializer, notifyDeserializer, notifySerializer } from "/js/serialize/pool-party.js";

import { version } from "/js/static/version.js";

import IDManager  from "/js/common/id-manager.js";
import RTCManager from "/js/common/rtc-manager.js";

import BroadSocket  from "./ws/broadsocket.js";
import StatusSocket from "./ws/status-socket.js";

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

export default class ConnectionManager {

  #broadSocket     = undefined; // BroadSocket
  #initJoiner      = undefined; // (UUID, String) => Unit
  #onDisconnect    = undefined; // (UUID) => Unit
  #passwordMatches = undefined; // (String) => Boolean
  #registerPing    = undefined; // (UUID, Number) => Unit
  #relay           = undefined; // (Object[Any]) => Unit
  #rtcManager      = undefined; // RTCManager
  #sessions        = undefined; // Object[Session]
  #statusSocket    = undefined; // StatusSocket

  // ((UUID, String) => Unit, (UUID, Number) => Unit, (Object[Any]) => Unit, (UUID) => Unit, (String) => Boolean) => ConnectionManager
  constructor(initJoiner, registerPing, relay, onDisconnect, passwordMatches) {
    this.#broadSocket     = new BroadSocket();
    this.#initJoiner      = initJoiner;
    this.#onDisconnect    = onDisconnect;
    this.#passwordMatches = passwordMatches;
    this.#registerPing    = registerPing;
    this.#relay           = relay;
    this.#rtcManager      = new RTCManager(true);
    this.#sessions        = {};
    this.#statusSocket    = new StatusSocket();
  }

  // () => Promise[Array[Number]]
  awaitBandwidthReport = () => this.#awaitSenders("request-bandwidth-report");

  // () => Promise[Array[Number]]
  awaitNewSendReport = () => this.#awaitSenders("request-new-send");

  // (String, Object[Any]?) => Unit
  broadcast = (type, message = {}) => {
    this.#rtcManager.sendBurst(...this.#getOpenChannels())(type, message);
  };

  // (UUID, String, String) => Unit
  connect = (hostID, nlogo, sessionName) => {

    const ocm = (c, id) => this.#onConnectionMessage(c, nlogo, sessionName, id);

    const registerSignaling = (signaling, joinerID) => {

      this.#sessions[joinerID] = { networking:     { signaling }
                                 , hasInitialized: false
                                 , pingData:       {}
                                 , recentPings:    []
                                 };

      notifySerializer  ("client-connect");
      notifyDeserializer("client-connect");

    };

    this. #broadSocket.connect(hostID, ocm, registerSignaling);
    this.#statusSocket.connect(hostID);

    setInterval(() => {
      const nameIsDefined = (s) => s.username !== undefined;
      const numPeers      = Object.values(this.#sessions).filter(nameIsDefined).length;
      this.#statusSocket.updateNumPeers(numPeers);
    }, 1000);

    setInterval(() => {

      const channels =
        Object.
          values(this.#sessions).
          map((session) => session.networking.channel).
          filter((channel) => channel !== undefined);

      channels.forEach((channel) => this.#rtcManager.send(channel)("keep-alive", {}));

    }, 30000);

    setInterval(() => {

      const idManager = new IDManager();

      Object.values(this.#sessions).forEach((session) => {
        const channel = session.networking.channel;
        if (channel !== undefined) {
          const idType         = `${channel.label}-${channel.id}-ping`;
          const id             = idManager.next(idType);
          session.pingData[id] = performance.now();
          const lastIndex      = session.recentPings.length - 1;
          const lastPing       = session.recentPings[lastIndex];
          this.#rtcManager.send(channel)("ping", { id, lastPing });
        }
      });

    }, 2000);

  };

  // () => Number
  getBandwidth = () => {
    return this.#rtcManager.getBandwidth();
  };

  // () => Object[UUID, RTCDataChannel]
  getChannelObj = () => {
    const pairs    = Object.entries(this.#sessions);
    const filtered = pairs.filter(([  , s]) => s.networking.channel !== undefined);
    const entries  = filtered.map(([id, s]) => [id, s.networking.channel]);
    return Object.fromEntries(entries);
  };

  // () => Number
  getNewSend = () => {
    return this.#rtcManager.getNewSend();
  };

  // (UUID, String, Object[Any]?) => Unit
  narrowcast = (joinerID, type, message = {}) => {
    const channel = this.#getOpenChannelByID(joinerID, true);
    if (channel !== null) {
      this.#rtcManager.sendBurst(channel)(type, message);
    }
  };

  // (Blob) => Unit
  postImageUpdate = (blob) => {
    this.#statusSocket.postImageUpdate(blob);
  };

  // (UUID) => Unit
  primeSession = (joinerID) => {
    if (this.#sessions[joinerID] !== undefined) {
      this.#sessions[joinerID].hasInitialized = true;
    }
  };

  // () => Unit
  teardown = () => {
    Object.values(this.getChannelObj()).forEach(
      (channel) => {
        this.#rtcManager.send(channel)("bye-bye");
        channel.close(1000, "Terminating unneeded sockets...");
      }
    );
  };

  // (Object[Any]) => Unit
  #awaitSenders = (msg) => {
    const seshes     = Object.values(this.#sessions);
    const signalers  = seshes.map((s) => s.networking.signaling);
    const untermies  = signalers.filter((s) => !s.isTerminated());
    const awaitables = [this.#broadSocket, this.#statusSocket].concat(untermies);
    const promises   = awaitables.map((s) => s.await(msg));
    return Promise.all(promises);
  };

  // (UUID) => Unit
  #disown = (joinerID) => {
    this.#onDisconnect(joinerID);
    notifySerializer  ("client-disconnect");
    notifyDeserializer("client-disconnect");
    delete this.#sessions[joinerID];
  };

  // (RTCPeerConnection, String, String, String) => (RTCSessionDescription) => Unit
  #processOffer = (connection, nlogo, sessionName, joinerID) => (offer) => {

    const rtcID       = uuidToRTCID(joinerID);
    const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
    channel.onopen    = () => { this.#rtcManager.sendGreeting(channel); };
    channel.onmessage = this.#onChannelMessages(channel, nlogo, sessionName, joinerID);
    channel.onclose   = () => { this.#disown(joinerID); };

    const session = this.#sessions[joinerID];

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
        this.#disown(joinerID);
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

  // () => Array[RTCDataChannel]
  #getOpenChannels = () => {
    return Object.keys(this.#sessions).
      map(this.#getOpenChannelByID).
      filter((c) => c !== null);
  };

  // (UUID, Boolean?) => RTCDataChannel?
  #getOpenChannelByID = (uuid, allowUninited = false) => {
    const session = this.#sessions[uuid];
    if (session !== undefined && (allowUninited || session.hasInitialized) &&
        session.networking.channel?.readyState === "open") {
      return session.networking.channel;
    } else {
      return null;
    }
  };

  // (RTCPeerConnection, String, String, String) => (Object[Any]) => Unit
  #onConnectionMessage = (connection, nlogo, sessionName, joinerID) => ({ data }) => {
    const datum = JSON.parse(data);
    switch (datum.type) {
      case "joiner-offer": {
        this.#processOffer(connection, nlogo, sessionName, joinerID)(datum.offer);
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
  #onChannelMessages = (channel, nlogo, sessionName, joinerID) => ({ data }) => {

    const message = { parcel: new Uint8Array(data) };

    awaitDeserializer("deserialize", message).then((datum) => {

      switch (datum.type) {

        case "connection-established": {

          if (datum.protocolVersion !== version) {

            const sesh = this.#sessions[joinerID];
            const id   = sesh?.username || joinerID;

            alert(`HubNet protocol version mismatch!  You are using protocol version '${version}', while client '${id}' is using version '${datum.v}'.  To ensure that you and the client are using the same version of HubNet Web, all parties should clear their browser cache and try connecting again.  The offending client has been disconnected.`);

            if (sesh !== undefined) {
              sesh.networking.channel.close();
              delete this.#sessions[joinerID];
            }

          }

          break;

        }

        case "login": {
          this.#handleLogin(channel, nlogo, sessionName, datum, joinerID);
          break;
        }

        case "pong": {

          const sesh       = this.#sessions[joinerID];
          const pingBucket = sesh.pingData[datum.id];
          const pingTime   = performance.now() - pingBucket;
          delete pingBucket[datum.id];

          sesh.recentPings.push(pingTime);
          if (sesh.recentPings.length > 5) {
            sesh.recentPings.shift();
          }

          this.#registerPing(joinerID, pingTime);

          break;

        }

        case "relay": {
          this.#relay(datum.payload);
          break;
        }

        case "bye-bye": {
          this.#disown(joinerID);
          break;
        }

        default: {
          console.warn(`Unknown channel event type: ${datum.type}`);
        }

      }

    });

  };

  // (RTCDataChannel, String, String, { username :: String, password :: String }, String) => Unit
  #handleLogin = (channel, nlogo, sessionName, datum, joinerID) => {

    if (datum.username !== undefined) {

      const isRelevant = ([k, s]) => k !== joinerID && s.username !== undefined;
      const isTaken    = ([ , s]) => s.username.toLowerCase() === joinerUsername;

      const joinerUsername  = datum.username.toLowerCase();
      const relevantPairs   = Object.entries(this.#sessions).filter(isRelevant);
      const usernameIsTaken = relevantPairs.some(isTaken);

      if (!usernameIsTaken) {
        if (this.#passwordMatches(datum.password)) {

          const session = this.#sessions[joinerID];

          session.networking.signaling.terminate();

          session.username = datum.username;
          this.#rtcManager.send(channel)("login-successful", {});

          this.#initJoiner(joinerID, this.#sessions[joinerID].username);

        } else {
          this.#rtcManager.send(channel)("incorrect-password", {});
        }
      } else {
        this.#rtcManager.send(channel)("username-already-taken", {});
      }

    } else {
      this.#rtcManager.send(channel)("no-username-given", {});
    }

  };

}

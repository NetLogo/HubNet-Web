import { uuidToRTCID } from "/js/common/util.js";

import { awaitDeserializer, notifyDeserializer, notifySerializer } from "/js/serialize/pool-party.js";

import { version } from "/js/static/version.js";

import BroadSocket    from "./broadsocket.js";
import SessionManager from "./session-manager.js";
import StatusSocket   from "./status-socket.js";

import RTCManager from "/js/common/rtc-manager.js";

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

  #awaitJoinerInit  = undefined; // (UUID, String) => Promise[Object[Any]]
  #broadSocket      = undefined; // BroadSocket
  #notifyUser       = undefined; // (String) => Unit
  #onDisconnect     = undefined; // (UUID) => Unit
  #passwordMatches  = undefined; // (String) => Boolean
  #registerPingTime = undefined; // (UUID, Number) => Unit
  #relay            = undefined; // (Object[Any]) => Unit
  #rtcManager       = undefined; // RTCManager
  #sessionManager   = undefined; // SessionManager
  #statusSocket     = undefined; // StatusSocket

  // ((UUID, String) => Promise[Object[Any]], (UUID, Number) => Unit, (Object[Any]) => Unit, (UUID) => Unit, (String) => Boolean) => ConnectionManager
  constructor( awaitJoinerInit, registerPing, relay, onDisconnect, passwordMatches
             , notifyUser) {
    this.#awaitJoinerInit  = awaitJoinerInit;
    this.#broadSocket      = new BroadSocket();
    this.#notifyUser       = notifyUser;
    this.#onDisconnect     = onDisconnect;
    this.#passwordMatches  = passwordMatches;
    this.#registerPingTime = registerPing;
    this.#relay            = relay;
    this.#rtcManager       = new RTCManager(true);
    this.#sessionManager   = new SessionManager();
    this.#statusSocket     = new StatusSocket();
  }

  // () => Promise[Array[Number]]
  awaitBandwidthReport = () => this.#awaitSenders("request-bandwidth-report");

  // () => Promise[Array[Number]]
  awaitNewSendReport = () => this.#awaitSenders("request-new-send");

  // (String, Object[Any]?) => Unit
  broadcast = (type, message = {}) => {
    const channels = this.#sessionManager.getOpenChannels();
    this.#rtcManager.sendBurst(...channels)(type, message);
  };

  // (UUID, String, String) => Unit
  connect = (hostID, nlogo, sessionName) => {

    const onCM = (c, id) => this.#onConnectionMessage(c, nlogo, sessionName, id);

    const registerSignaling = (joinerID, signaling) => {
      this.#sessionManager.register(joinerID, signaling);
      notifySerializer  ("client-connect");
      notifyDeserializer("client-connect");
    };

    this. #broadSocket.connect(hostID, onCM, registerSignaling);
    this.#statusSocket.connect(hostID);

    setInterval(() => {
      const numPeers = this.#sessionManager.getNumActive();
      this.#statusSocket.updateNumPeers(numPeers);
    }, 1000);

    setInterval(() => {
      const channels = this.#sessionManager.getAllChannels();
      channels.forEach((chan) => this.#rtcManager.send(chan)("keep-alive", {}));
    }, 30000);

    setInterval(() => {
      this.#sessionManager.startNewPingWave().forEach(
        ([channel, id, lastPing]) => {
          this.#rtcManager.send(channel)("ping", { id, lastPing });
        }
      );
    }, 2000);

  };

  // () => Number
  getBandwidth = () => {
    return this.#rtcManager.getBandwidth();
  };

  // () => Object[UUID, RTCDataChannel]
  getChannelObj = () => {
    return this.#sessionManager.getChannelObj();
  };

  // () => Number
  getNewSend = () => {
    return this.#rtcManager.getNewSend();
  };

  // (UUID, String, Object[Any]?) => Unit
  narrowcast = (joinerID, type, message = {}) => {
    const channel = this.#sessionManager.getOpenChannelByID(joinerID, true);
    if (channel !== null) {
      this.#rtcManager.sendBurst(channel)(type, message);
    }
  };

  // (Blob) => Unit
  postImageUpdate = (blob) => {
    this.#statusSocket.postImageUpdate(blob);
  };

  // () => Unit
  teardown = () => {
    this.#sessionManager.getAllChannels().forEach(
      (channel) => {
        this.#rtcManager.send(channel)("bye-bye");
        channel.close(1000, "Terminating unneeded sockets...");
      }
    );
  };

  // (Object[Any]) => Unit
  #awaitSenders = (msg) => {
    const signalers  = this.#sessionManager.getSignalers();
    const awaitables = [this.#broadSocket, this.#statusSocket].concat(signalers);
    const promises   = awaitables.map((s) => s.await(msg));
    return Promise.all(promises);
  };

  // (UUID) => Unit
  #disown = (joinerID) => {
    this.#onDisconnect(joinerID);
    notifySerializer  ("client-disconnect");
    notifyDeserializer("client-disconnect");
    this.#sessionManager.unregister(joinerID);
  };

  // (RTCPeerConnection, String, String, String) => (RTCSessionDescription) => Unit
  #processOffer = (connection, nlogo, sessionName, joinerID) => (offer) => {

    const rtcID       = uuidToRTCID(joinerID);
    const channel     = connection.createDataChannel("hubnet-web", { negotiated: true, id: rtcID });
    channel.onopen    = () => { this.#rtcManager.sendGreeting(channel); };
    channel.onmessage = this.#onChannelMessages(channel, nlogo, sessionName, joinerID);
    channel.onclose   = () => { this.#disown(joinerID); };

    this.#sessionManager.setNetworking(joinerID, connection, channel);

    let knownCandies = new Set([]);

    connection.onicecandidate =
      ({ candidate }) => {
        if (candidate !== undefined && candidate !== null) {
          const candy    = candidate.toJSON();
          const candyStr = JSON.stringify(candy);
          if (!knownCandies.has(candyStr)) {
            knownCandies = knownCandies.add(candyStr);
            this.#sessionManager.sendICECandidate(joinerID, candy);
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
        const desc = connection.localDescription.toJSON();
        this.#sessionManager.sendRTCAnswer(joinerID, desc);
      });

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
            const id = this.#sessionManager.invalidate(joinerID);
            this.#notifyUser(`HubNet protocol version mismatch!  You are using protocol version '${version}', while client '${id}' is using version '${datum.v}'.  To ensure that you and the client are using the same version of HubNet Web, all parties should clear their browser cache and try connecting again.  The offending client has been disconnected.`);
          }
          break;
        }

        case "login": {
          this.#handleLogin(channel, nlogo, sessionName, datum, joinerID);
          break;
        }

        case "pong": {
          const pingTime = this.#sessionManager.pong(joinerID, datum.id);
          this.#registerPingTime(joinerID, pingTime);
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

    const reply = (msgType) => { this.#rtcManager.send(channel)(msgType); };

    if (datum.username !== undefined) {

      if (this.#sessionManager.usernameIsUnique(joinerID, datum.username)) {
        if (this.#passwordMatches(datum.password)) {

          this.#sessionManager.logIn(joinerID, datum.username);
          reply("login-successful");

          this.#awaitJoinerInit(joinerID, datum.username).
            then(({ role, state, viewState: view }) => {
              const token = joinerID;
              this.narrowcast(token, "initial-model", { role, token, state, view });
              this.#sessionManager.setInitialized(token);
            });

        } else {
          reply("incorrect-password");
        }
      } else {
        reply("username-already-taken");
      }

    } else {
      reply("no-username-given");
    }

  };

}

import IDManager from "/js/common/id-manager.js";

export default class SessionManager {

  #pingIDManager = undefined; // IDManager
  #sessions      = undefined; // Object[Session]

  // () => SessionManager
  constructor() {
    this.#pingIDManager = new IDManager();
    this.#sessions      = {};
  }

  // () => Array[RTCDataChannel]
  getAllChannels = () => {
    return Object.values(this.#getChannelObj);
  };

  // () => Object[UUID, Number]
  getBufferedAmounts = () => {
    return Object.entries(this.#getChannelObj).
      map(([uuid, channel]) => [uuid, channel.bufferedAmount]);
  };

  // (UUID, Boolean?) => RTCDataChannel?
  getOpenChannelByID = (uuid, allowUninited = false) => {
    const session = this.#sessions[uuid];
    if (session !== undefined && (allowUninited || session.hasInitialized) &&
        session.networking.channel?.readyState === "open") {
      return session.networking.channel;
    } else {
      return null;
    }
  };

  // () => Array[RTCDataChannel]
  getOpenChannels = () => {
    return Object.keys(this.#sessions).
      map(this.getOpenChannelByID).
      filter((c) => c !== null);
  };

  // () => Number
  getNumActive = () => {
    const nameIsDefined = (s) => s.username !== undefined;
    return Object.values(this.#sessions).filter(nameIsDefined).length;
  };

  // () => Array[SignalingSocket]
  getSignalers = () => {
    const seshes    = Object.values(this.#sessions);
    const signalers = seshes.map((s) => s.networking.signaling);
    const untermies = signalers.filter((s) => !s.isTerminated());
    return untermies;
  };

  // (UUID) => String
  invalidate = (joinerID) => {
    const sesh = this.#sessions[joinerID];
    if (sesh !== undefined) {
      const username = sesh.username;
      sesh.networking.channel.close();
      delete this.#sessions[joinerID];
      return username;
    } else {
      return joinerID;
    }
  };

  // (UUID, String) => Unit
  logIn = (joinerID, username) => {
    const session = this.#sessions[joinerID];
    session.networking.signaling.terminate();
    session.username = username;
  };

  // (UUID, RTCIceCandidate) => Unit
  sendICECandidate = (joinerID, candidate) => {
    const signaling = this.#sessions[joinerID].networking.signaling;
    if (!signaling.isTerminated()) {
      signaling.sendICECandidate(candidate);
    }
  };

  // (UUID, RTCSessionDescription) => Unit
  sendRTCAnswer = (joinerID, answer) => {
    const signaling = this.#sessions[joinerID].networking.signaling;
    if (!signaling.isTerminated()) {
      signaling.sendAnswer(answer);
    }
  };

  // (UUID, RTCPeerConnection, RTCDataChannel) => Unit
  setNetworking = (joinerID, connection, channel) => {
    const nw      = this.#sessions[joinerID].networking;
    nw.connection = connection;
    nw.channel    = channel;
  };

  // () => Array[(RTCDataChannel, Number, Number)]
  startNewPingWave = () => {
    return Object.values(this.#sessions).map((session) => {
      const channel = session.networking.channel;
      if (channel !== undefined) {
        const idType         = `${channel.label}-${channel.id}-ping`;
        const id             = this.#pingIDManager.next(idType);
        session.pingData[id] = performance.now();
        const lastIndex      = session.recentPings.length - 1;
        const lastPing       = session.recentPings[lastIndex];
        return [channel, id, lastPing];
      } else {
        return undefined;
      }
    }).filter(
      (tuple) => tuple !== undefined
    );
  };

  // (UUID, Number) => Number
  pong = (joinerID, id) => {

    const sesh       = this.#sessions[joinerID];
    const pingBucket = sesh.pingData[id];
    const pingTime   = performance.now() - pingBucket;
    delete pingBucket[id];

    sesh.recentPings.push(pingTime);
    if (sesh.recentPings.length > 5) {
      sesh.recentPings.shift();
    }

    return pingTime;

  };

  // (UUID, SignalingSocket) => Unit
  register = (joinerID, signaling) => {
    this.#sessions[joinerID] = { networking:     { signaling }
                               , hasInitialized: false
                               , pingData:       {}
                               , recentPings:    []
                               };
  };

  // (UUID) => Unit
  setInitialized = (joinerID) => {
    if (this.#sessions[joinerID] !== undefined) {
      this.#sessions[joinerID].hasInitialized = true;
    }
  };

  // (UUID) => Unit
  unregister = (joinerID) => {
    delete this.#sessions[joinerID];
  };

  // (UUID, String) => Boolean
  usernameIsUnique = (joinerID, username) => {

    const isRelevant = ([k, s]) => k !== joinerID && s.username !== undefined;
    const isTaken    = ([ , s]) => s.username.toLowerCase() === joinerUsername;

    const joinerUsername  = username.toLowerCase();
    const relevantPairs   = Object.entries(this.#sessions).filter(isRelevant);
    const usernameIsTaken = relevantPairs.some(isTaken);

    return !usernameIsTaken;

  };

  // () => Object[UUID, RTCDataChannel]
  #getChannelObj = () => {
    const pairs    = Object.entries(this.#sessions);
    const filtered = pairs.filter(([  , s]) => s.networking.channel !== undefined);
    const entries  = filtered.map(([id, s]) => [id, s.networking.channel]);
    return Object.fromEntries(entries);
  };

}

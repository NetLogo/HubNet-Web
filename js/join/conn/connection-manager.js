import RxQueue                               from "/js/common/rx-queue.js";
import { checkIsTURN, genUUID, uuidToRTCID } from "/js/common/util.js";

import { version } from "/js/static/version.js";

import { rtcConfig } from "./webrtc.js";

import ChannelHandler  from "./channel-handler.js";
import SignalingStream from "./signaling-stream.js";

import ChatSocket from "/js/common/chat-socket.js";
import RTCManager from "/js/common/rtc-manager.js";

export default class ConnectionManager {

  #channel         = undefined; // RTCDataChannel
  #chatSocket      = undefined; // ChatSocket
  #conn            = undefined; // RTCPeerConnection
  #isRetrying      = undefined; // Boolean
  #retrialUUID     = undefined; // UUID
  #rtcMan          = undefined; // RTCManager
  #rxQueue         = undefined; // RxQueue
  #disconnectError = undefined; // Boolean

  // () => ConnectionManager
  constructor(chatManager) {
    this.#chatSocket  = new ChatSocket(chatManager);
    this.#isRetrying  = false;
    this.#retrialUUID = genUUID();
    this.reset();
  }

  // () => Unit
  disconnect = () => {
    if (this.#channel !== null) {
      this.send("bye-bye");
      this.#disconnectError = false;
      this.#channel.close();
      this.#channel = null;
    }
  };

  // ( UUID, String, String, Object[Any], Object[Any], (Object[Any]) => Object[Any], () => Unit
  // , () => Unit, () => Unit, (String) => Unit, (Boolean, () => Unit) => Unit, () => Unit, (() => Unit) => Unit
  // , () => Unit) =>
  // (UUID) => Unit
  logIn = ( hostID, username, password, genCHBundle, notifyLoggingIn
          , notifyICEConnLost, onDoorbell, notifyUser, notifyFull, onTeardown
          , retry) =>
          (joinerID) => {

    this.#initiateRTC(joinerID).
      then(([channel, offer]) => {

        const retryConn = () => {
          this.#isRetrying = true;
          this.reset();
          retry();
        };

        this.#joinSession( hostID, joinerID, username, password, offer, channel
                         , genCHBundle, notifyLoggingIn, notifyICEConnLost
                         , onDoorbell, notifyFull, onTeardown, retryConn);

      }).catch(
        error => notifyUser(`Cannot join session: ${error.message}`)
      );

  };

  // () => Unit
  reset = () => {

    this.#conn   ?.close();
    this.#channel?.close();
    this.#rxQueue?.reset();

    this.#conn    = new RTCPeerConnection(rtcConfig);
    this.#channel = null;
    this.#rtcMan  = new RTCManager(false);

  };

  // (String, Object[Any]?) => Unit
  send = (type, msg = {}) => {
    if (this.#channel !== null) {
      this.#rtcMan.send(this.#channel)(type, msg);
    }
  };

  // () => Unit
  terminate = () => {
    this.#channel.close(1000, "Connection closed by host");
  };

  // ((Object[Any]) => Object[Any], () => Unit, () => Unit, String, String) => RxQueue
  #genRxQueue = (genCHBundle, closeSignaling, retryConn, username, password) => {

    const sendLogIn = () => {
      this.#isRetrying = false;
      this.send("login", { username, password });
    };

    const connCHBundle =
      { disconnect:             this.disconnect
      , closeSignaling
      , getConnectionStats:     () => this.#conn.getStats()
      , retryConn
      , send:                   this.send
      , sendLogIn
      , terminate:              this.terminate
      };

    const chanHanBundle = genCHBundle(connCHBundle);
    const chanHan       = new ChannelHandler(chanHanBundle);
    const rxQueue       = new RxQueue(chanHan, false);

    return rxQueue;

  };

  // (UUID, UUID, RTCSessionDescriptionInit, () => Unit) => SignalingStream
  #genSignalingStream = (hostID, joinerID, offer, notifyFull) => {

    const setRTCDesc =
      (answer) => {
        if (this.#conn.remoteDescription === null) {
          this.#conn.setRemoteDescription(answer);
        }
      };

    const addRTCICE = (c) => { this.#conn.addIceCandidate(c); };

    return new SignalingStream( hostID, joinerID, offer
                              , setRTCDesc, addRTCICE, notifyFull);

  };

  // (UUID) => Promise[(RTCDataChannel, RTCSessionDescriptionInit)]
  #initiateRTC = (joinerID) => {
    if (joinerID !== "No more hashes") {
      const rtcID   = uuidToRTCID(joinerID);
      const rtcOpts = { negotiated: true, id: rtcID };
      const channel = this.#conn.createDataChannel("hubnet-web", rtcOpts);
      return this.#conn.createOffer().then(
        (ofr) => {
          // For Safari 15- --Jason B. (11/1/21)
          const isntSafari = ofr instanceof RTCSessionDescription;
          const offer      = isntSafari ? ofr.toJSON() : ofr;
          return [channel, offer];
        }
      );
    } else {
      return Promise.reject(new Error("Session is full"));
    }
  };

  // ( UUID, UUID, String, String, RTCSessionDescriptionInit, RTCDataChannel
  // , (Object[Any]) => Object[Any], () => Unit, () => Unit, () => Unit
  // , () => Unit, (Boolean, () => Unit) => Unit, () => Unit) => Unit
  #joinSession = ( hostID, joinerID, username, password, offer, channel
                 , genCHBundle, notifyLoggingIn, notifyICEConnLost, onDoorbell
                 , notifyFull, onTeardown, retryConn) => {

    const gen             = this.#genSignalingStream;
    const signalingStream = gen(hostID, joinerID, offer, notifyFull);

    this.#rxQueue = this.#genRxQueue( genCHBundle, signalingStream.terminate
                                    , retryConn, username, password);

    this.#channel = channel;

    this.#conn.setLocalDescription(offer);
    this.#registerICEListeners(signalingStream, onTeardown, notifyICEConnLost);
    this.#registerChannelListeners( channel, notifyLoggingIn, onDoorbell
                                  , onTeardown);


  };

  // (RTCDataChannel, () => Unit, () => Unit, (Boolean) => Unit) => Unit
  #registerChannelListeners = ( channel, notifyLoggingIn, onDoorbell
                              , onTeardown) => {

    channel.onopen = () => {

      notifyLoggingIn();
      onDoorbell();

      this.#conn.getStats().then(
        (stats) => {
          const usesTURN = checkIsTURN(stats);
          const uuid     = this.#retrialUUID;
          const msg      = { uuid, protocolVersion: version, usesTURN };
          this.#rtcMan.send(channel)("connection-established", msg);
        }
      );

    };

    channel.onclose = (e) => {
      onTeardown(!this.#isRetrying && this.#disconnectError !== false);
      this.#isRetrying = false;
    };

    channel.onmessage = this.#rxQueue.enqueue;

  };

  // (SignalingStream, (Boolean, () => Unit) => Unit, () => Unit) => Unit
  #registerICEListeners = (signalingStream, onTeardown, notifyICEConnLost) => {

    let knownCandies = new Set([]);

    this.#conn.onicecandidate =
      ({ candidate }) => {
        if (candidate !== undefined && candidate !== null) {
          const candy    = candidate.toJSON();
          const candyStr = JSON.stringify(candy);
          if (!knownCandies.has(candyStr)) {
            knownCandies = knownCandies.add(candyStr);
            signalingStream.sendICE(candy);
          }
        }
      };

    this.#conn.oniceconnectionstatechange = () => {
      if (this.#conn.iceConnectionState === "disconnected") {
        onTeardown(true, notifyICEConnLost);
      }
    };

  };

}

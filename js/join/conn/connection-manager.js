import RxQueue         from "/js/common/rx-queue.js";
import { uuidToRTCID } from "/js/common/util.js";

import { rtcConfig } from "./webrtc.js";

import ChannelHandler  from "./channel-handler.js";
import SignalingStream from "./signaling-stream.js";

import ChatSocket from "/js/common/chat-socket.js";
import RTCManager from "/js/common/rtc-manager.js";

export default class ConnectionManager {

  #channel     = undefined; // RTCDataChannel
  #chatSocket  = undefined; // ChatSocket
  #conn        = undefined; // RTCPeerConnection
  #isLeaving   = undefined; // Boolean
  #rtcMan      = undefined; // RTCManager
  #rxQueue     = undefined; // RxQueue

  // () => ConnectionManager
  constructor(chatManager) {
    this.#chatSocket  = new ChatSocket(chatManager);
    this.#isLeaving   = false;
    this.reset();
  }

  // () => Unit
  disconnect = () => {
    if (this.#channel !== null) {
      this.send("bye-bye");
      this.#isLeaving = true;
      this.#channel.close();
      this.#channel = null;
    }
  };

  // ( UUID, String, String, Number, Object[Any], Object[Any], (Object[Any]) => Object[Any], () => Unit
  // , () => Unit, () => Unit, (String) => Unit, (Boolean, () => Unit) => Unit, () => Unit, (() => Unit) => Unit) =>
  // (UUID) => Unit
  logIn = ( hostID, username, password, roleIndex, genCHBundle, notifyLoggingIn
          , notifyICEConnLost, onDoorbell, notifyUser, notifyFull, onTeardown) =>
          (joinerID) => {
    this.#initiateRTC(joinerID).
      then(([channel, offer]) => {
        this.#joinSession( hostID, joinerID, username, password, roleIndex, offer
                         , channel, genCHBundle, notifyLoggingIn, notifyICEConnLost
                         , onDoorbell, notifyFull, onTeardown);
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

  // ((Object[Any]) => Object[Any], () => Unit) => RxQueue
  #genRxQueue = (genCHBundle, closeSignaling) => {

    const connCHBundle =
      { disconnect:             this.disconnect
      , closeSignaling
      , getConnectionStats:     () => this.#conn.getStats()
      , resetConn:              this.reset
      , send:                   this.send
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

      channel.binaryType = "arraybuffer";

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

  // ( UUID, UUID, String, String, Number, RTCSessionDescriptionInit, RTCDataChannel
  // , (Object[Any]) => Object[Any], () => Unit, () => Unit, () => Unit
  // , () => Unit, (Boolean, () => Unit) => Unit) => Unit
  #joinSession = ( hostID, joinerID, username, password, roleIndex, offer, channel
                 , genCHBundle, notifyLoggingIn, notifyICEConnLost, onDoorbell
                 , notifyFull, onTeardown) => {

    const gen             = this.#genSignalingStream;
    const signalingStream = gen(hostID, joinerID, offer, notifyFull);

    this.#rxQueue = this.#genRxQueue(genCHBundle, signalingStream.terminate);
    this.#channel = channel;

    this.#conn.setLocalDescription(offer);
    this.#registerICEListeners(signalingStream, onTeardown, notifyICEConnLost);
    this.#registerChannelListeners( channel, username, password, roleIndex
                                  , notifyLoggingIn, onDoorbell, onTeardown);


  };

  // ( RTCDataChannel, String, String, Number, () => Unit, () => Unit
  // , (Boolean) => Unit) => Unit
  #registerChannelListeners = ( channel, username, password, roleIndex
                              , notifyLoggingIn, onDoorbell, onTeardown) => {

    channel.onopen = () => {
      notifyLoggingIn();
      onDoorbell();
      this.#rtcMan.sendGreeting(this.#channel);
      this.send("login", { username, password, roleIndex });
    };

    channel.onclose = () => {
      onTeardown(!this.#isLeaving);
      this.#isLeaving  = false;
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

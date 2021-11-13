import { uuidToRTCID  } from "./common.js";
import { joinerConfig } from "./webrtc.js";

import ChannelHandler  from "./channel-handler.js";
import SignalingStream from "./signaling-stream.js";
import RxQueue         from "./rx-queue.js";

import * as CompressJS from "./compress.js";

const sendGreeting = CompressJS.sendGreeting(false);
const sendRTC      = CompressJS.sendRTC     (false);

// type SendRTC = (RTCDataChannel) => (String, Object[Any]?) => Unit

export default class ConnectionManager {

  #channel = undefined; // RTCDataChannel
  #conn    = undefined; // RTCPeerConnection
  #rxQueue = undefined; // RxQueue

  // () => ConnectionManager
  constructor() {
    this.reset();
  }

  // () => Unit
  disconnect = () => {
    if (this.#channel !== null) {
      this.send("bye-bye");
      this.#channel.close(1000, "Connection closed by user");
      this.#channel = null;
    }
  };

  // ( UUID, String, String, Object[Any], Object[Any], (Object[Any]) => Object[Any], () => Unit
  // , () => Unit, (String) => Unit, (Boolean, () => Unit) => Unit, (() => Unit) => Unit) => (UUID) => Unit
  logIn = ( hostID, username, password, genCHBundle, notifyLoggingIn
          , notifyICEConnLost, notifyUser, onTeardown) => (joinerID) => {
    this.#initiateRTC(joinerID).
      then(([channel, offer]) => {
        this.#joinSession( hostID, joinerID, username, password, offer, channel
                         , genCHBundle, notifyLoggingIn, notifyICEConnLost
                         , onTeardown);
      }).catch(
        error => notifyUser(`Cannot join session: ${error.message}`)
      );
  };

  // () => Unit
  reset = () => {
    this.#conn    = new RTCPeerConnection(joinerConfig);
    this.#channel = null;
    this.#rxQueue?.reset();
  };

  // (String, Object[Any]?) => Unit
  send = (type, msg = {}) => {
    if (this.#channel !== null) {
      sendRTC(this.#channel)(type, msg);
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
      , send:                   this.send
      , terminate:              this.terminate
      };

    const chanHanBundle = genCHBundle(connCHBundle);
    const chanHan       = new ChannelHandler(chanHanBundle);
    const rxQueue       = new RxQueue(chanHan, false);

    return rxQueue;

  };

  // (UUID, UUID, RTCSessionDescriptionInit) => SignalingStream
  #genSignalingStream = (hostID, joinerID, offer) => {

    const setRTCDesc =
      (answer) => {
        if (this.#conn.remoteDescription === null) {
          this.#conn.setRemoteDescription(answer);
        }
      };

    const addRTCICE = (c) => { this.#conn.addIceCandidate(c); };

    return new SignalingStream(hostID, joinerID, offer, setRTCDesc, addRTCICE);

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
  // , (Object[Any]) => Object[Any], () => Unit, () => Unit, (Boolean, () => Unit) => Unit) => Unit
  #joinSession = ( hostID, joinerID, username, password, offer, channel
                 , genCHBundle, notifyLoggingIn, notifyICEConnLost, onTeardown) => {

    const signalingStream =
      this.#genSignalingStream(hostID, joinerID, offer);

    this.#registerICEListeners(signalingStream, onTeardown, notifyICEConnLost);

    this.#conn.setLocalDescription(offer);

    this.#rxQueue =
      this.#genRxQueue(genCHBundle, signalingStream.terminate);

    this.#registerChannelListeners( channel, username, password, notifyLoggingIn
                                  , this.#rxQueue, onTeardown);

    this.#channel = channel;

  };

  // (RTCDataChannel, String, String, () => Unit, RxQueue, (Boolean) => Unit) => Unit
  #registerChannelListeners = ( channel, username, password, notifyLoggingIn
                              , rxQueue, onTeardown) => {

    channel.onopen = () => {
      notifyLoggingIn();
      sendGreeting(this.#channel);
      this.send("login", { username, password });
    };

    channel.onclose = (e) => {
      onTeardown(e.code !== 1000);
    };

    channel.onmessage = rxQueue.enqueue;

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

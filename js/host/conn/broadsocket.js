import { rtcConfig } from "./webrtc.js";

import { awaitWorker } from "/js/common/await.js";

import { hnw } from "/js/static/domain.js";

import SignalingSocket from "./signaling-socket.js";

export default class BroadSocket {

  #worker = undefined; // Worker[StatusSocketWorker]

  // () => BroadSocket
  constructor() {
    const url = "js/host/conn/broadsocket-worker.js";
    this.#worker = new Worker(url, { type: "module" });
  }

  // (String) => Promise[_]
  "await" = (msg) => {
    return awaitWorker(this.#worker)(msg);
  };

  // (UUID, (RTCPeerConnection, UUID) => (Object[Any]) => Unit, (Worker) => Unit) => Unit
  connect = (hostID, handleConnectionMessage, registerSignaling) => {

    const mc = new MessageChannel();

    mc.port1.onmessage =
      handleSocketMessage(hostID, handleConnectionMessage, registerSignaling);

    const url = `ws://${hnw}/rtc/${hostID}`;
    this.#worker.postMessage({ type: "connect", url }, [mc.port2]);

  };

}

// (UUID, (RTCPeerConnection, UUID) => (Object[Any]) => Unit, (Worker) => Unit) =>
// (Object[{ data :: UUID }]) => Unit
const handleSocketMessage = (hostID, handleConnectionMessage, registerSignaling) =>
                            ({ data: joinerID }) => {

  const signaling  = new SignalingSocket();

  const connection = new RTCPeerConnection(rtcConfig);
  const onMsg      = handleConnectionMessage(connection, joinerID);

  signaling.connect(hostID, joinerID, onMsg);

  registerSignaling(signaling, joinerID);

};

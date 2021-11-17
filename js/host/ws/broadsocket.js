import { rtcConfig } from "./webrtc.js";

import { awaitWorker } from "/js/common/await.js";

import { hnw } from "/js/static/domain.js";

export default class BroadSocket {

  #worker = undefined; // Worker[StatusSocketWorker]

  // () => BroadSocket
  constructor() {
    const url = "js/host/ws/broadsocket-worker.js";
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

  const signalingURL = "js/host/ws/signaling-socket-worker.js";
  const signaling    = new Worker(signalingURL, { type: "module" });

  const connection    = new RTCPeerConnection(rtcConfig);
  signaling.onmessage = handleConnectionMessage(connection, joinerID);

  const url = `ws://${hnw}/rtc/${hostID}/${joinerID}/host`;
  signaling.postMessage({ type: "connect", url });

  registerSignaling(signaling, joinerID);

};

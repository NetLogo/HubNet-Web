import { rtcConfig } from "./webrtc.js";

import { awaitWorker } from "/js/common/await.js";
import genWorker       from "/js/common/worker.js";

import { hnw, wsProto } from "/js/static/domain.js";

import SignalingSocket from "./signaling-socket.js";

export default class BroadSocket {

  #worker = undefined; // Worker[BroadSocketWorker]

  // () => BroadSocket
  constructor() {
    this.#worker = genWorker("js/host/conn/broadsocket-worker.js");
  }

  // (String) => Promise[_]
  "await" = (msg) => {
    return awaitWorker(this.#worker)(msg);
  };

  // (UUID, (RTCPeerConnection, UUID) => (Object[Any]) => Unit, (Worker) => Unit, () => Boolean) => Unit
  connect = (hostID, processOffer, registerSignaling, getFullness) => {

    const mc = new MessageChannel();

    mc.port1.onmessage =
      handleSocketMessage(hostID, processOffer, registerSignaling, getFullness);

    const url = `${wsProto}://${hnw}/rtc/${hostID}`;
    this.#worker.postMessage({ type: "connect", url }, [mc.port2]);

  };

}

// (UUID, (UUID, RTCPeerConnection) => (Object[Any]) => Unit, (UUID, SignalingSocket) => Unit, () => Boolean) =>
// (Object[{ data :: UUID }]) => Unit
const handleSocketMessage = (hostID, processOffer2, registerSignaling, getFullness) =>
                            ({ data: joinerID }) => {

  const signaling = new SignalingSocket(getFullness());

  const connection    = new RTCPeerConnection(rtcConfig);
  const processOffer0 = processOffer2(joinerID, connection);
  const addICE        = (candy) => { connection.addIceCandidate(candy); };

  signaling.connect(hostID, joinerID, processOffer0, addICE);

  registerSignaling(joinerID, signaling);

};

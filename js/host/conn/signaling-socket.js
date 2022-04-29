import { awaitWorker } from "/js/common/await.js";
import genWorker       from "/js/common/worker.js";

import { hnw, wsProto } from "/js/static/domain.js";

export default class SignalingSocket {

  #isDead = undefined; // Boolean
  #worker = undefined; // Worker[SignalingSocketWorker]

  // (Boolean) => SignalingSocket
  constructor(isAtCapacity) {
    this.#worker = genWorker("js/host/conn/signaling-socket-worker.js");
    this.#isDead = false;
    this.updateFullness(isAtCapacity);
  }

  // (String) => Promise[_]
  "await" = (msg) => {
    return awaitWorker(this.#worker)(msg);
  };

  // (UUID, UUID, (Object[Any]) => Unit, (RTCIceCandidate) => Unit) => Unit
  connect = (hostID, joinerID, processOffer, addICE) => {

    const mc = new MessageChannel();

    mc.port1.onmessage = handleConnectionMessage(processOffer, addICE);

    const url = `${wsProto}://${hnw}/rtc/${hostID}/${joinerID}/host`;
    this.#worker.postMessage({ type: "connect", url }, [mc.port2]);

  };

  // () => Boolean
  isTerminated = () => this.#isDead;

  // (Boolean) => Unit
  updateFullness = (isAtCapacity) => {
    this.#worker.postMessage({ type: "update-fullness", isAtCapacity });
  };

  // (RTCSessionDescription) => Unit
  sendAnswer = (answer) => {
    this.#worker.postMessage({ type: "answer", answer });
  };

  // (RTCIceCandidate) => Unit
  sendICECandidate = (candidate) => {
    this.#worker.postMessage({ type: "ice-candidate", candidate });
  };

  // () => Unit
  terminate = () => {
    this.#isDead = true;
  };

}

// ((RTCSessionDescriptionInit) => Unit, (RTCIceCandidate) => Unit) => (Object[Any]) => Unit
const handleConnectionMessage = (processOffer, addICE) => ({ data }) => {

  const datum = JSON.parse(data);

  switch (datum.type) {

    case "joiner-offer": {
      processOffer(datum.offer);
      break;
    }

    case "joiner-ice-candidate": {
      addICE(datum.candidate);
      break;
    }

    case "bye-bye":
    case "keep-alive": {
      break;
    }

    default: {
      console.warn("Unknown narrow event type:", datum.type);
    }

  }

};

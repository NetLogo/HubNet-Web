import { awaitWorker } from "/js/common/await.js";

import { hnw, wsProto } from "/js/static/domain.js";

export default class SignalingSocket {

  #isDead = undefined; // Boolean
  #worker = undefined; // Worker[SignalingSocketWorker]

  // () => SignalingSocket
  constructor() {
    const url    = "js/host/conn/signaling-socket-worker.js";
    this.#worker = new Worker(url, { type: "module" });
    this.#isDead = false;
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
      console.warn(`Unknown narrow event type: ${datum.type}`);
    }

  }

};

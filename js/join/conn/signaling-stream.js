import genWorker from "/js/common/worker.js";

export default class SignalingStream {

  #worker = undefined; // Worker[JoinerSignalingWorker]

  // ( String, String, RTCSessionDescriptionInit
  // , (RTCSessionDescription) => Unit, (RTCIceCandidate) => Unit, () => Unit) => SignalingStream
  constructor(hostID, joinerID, offer, setRTCDesc, addRTCICE, notifyFull) {
    this.#worker = genWorker("js/join/conn/signaling-worker.js");
    this.#connect(hostID, joinerID, offer);
    this.#worker.onmessage =
      onSignalingMessage(setRTCDesc, addRTCICE, notifyFull, this.terminate);
  }

  // (RTCIceCandidate) => Unit
  sendICE = (candidate) => {
    this.#send("ice-candidate", { candidate });
  };

  // () => Unit
  terminate = () => {
    if (this.#worker !== null) {
      this.#worker.terminate();
      this.#worker = null;
    }
  };

  // (String, String, RTCSessionDescriptionInit) => Unit
  #connect = (hostID, joinerID, offer) => {
    this.#send("connect", { hostID, joinerID, offer });
  };

  // (String, Object[Any]) => Unit
  #send = (type, msg = {}) => {
    if (this.#worker !== null) {
      this.#worker.postMessage({ type, ...msg });
    }
  };

}

// ((RTCSessionDescription) => Unit, (RTCIceCandidate) => Unit, () => Unit, () => Unit) =>
// (Object[Any]) => Unit
const onSignalingMessage = (setRTCDesc, addRTCICE, notifyFull, selfDestruct) =>
                           ({ data }) => {
  const datum = JSON.parse(data);
  switch (datum.type) {
    case "host-answer": {
      setRTCDesc(datum.answer);
      break;
    }
    case "host-ice-candidate": {
      addRTCICE(datum.candidate);
      break;
    }
    case "bye-bye": {
      console.warn("Central server disconnected from signaling");
      break;
    }
    case "keep-alive": {
      break;
    }
    case "pool's-closed": {
      selfDestruct();
      notifyFull();
      break;
    }
    default: {
      console.warn("Unknown signaling message type:", datum.type);
    }
  }
};

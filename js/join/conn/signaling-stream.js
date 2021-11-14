// ((RTCSessionDescription) => Unit, (RTCIceCandidate) => Unit) => (Object[Any]) => Unit
const onSignalingMessage = (setRTCDesc, addRTCICE) => ({ data }) => {
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
    default: {
      console.warn(`Unknown signaling message type: ${datum.type}`);
    }
  }
};

export default class SignalingStream {

  #worker = undefined; // Worker[JoinerSignalingWorker]

  // ( String, String, RTCSessionDescriptionInit
  // , (RTCSessionDescription) => Unit, (RTCIceCandidate) => Unit) => SignalingStream
  constructor(hostID, joinerID, offer, setRTCDesc, addRTCICE) {
    const buddyURL = "js/join/conn/signaling-worker.js";
    this.#worker = new Worker(buddyURL, { type: "module" });
    this.#connect(hostID, joinerID, offer);
    this.#worker.onmessage = onSignalingMessage(setRTCDesc, addRTCICE);
  }

  // (RTCIceCandidate) => Unit
  sendICE = (candidate) => {
    this.#send("ice-candidate", { candidate });
  };

  // () => Unit
  terminate = () => {
    this.#worker.terminate();
    this.#worker = null;
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


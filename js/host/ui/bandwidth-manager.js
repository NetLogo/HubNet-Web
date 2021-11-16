import { reportBandwidth, reportNewSend } from "/js/common/bandwidth-monitor.js";
import { byteSizeLabel                  } from "/js/common/util.js";

export default class BandwidthManager {

  #congestionDuration = undefined; // Number
  #recentBuffers      = undefined; // Object[UUID, Array[Number]]
  #notifyCongested    = undefined; // () => Unit
  #notifyUncongested  = undefined; // () => Unit
  #setBandwidthDOM    = undefined; // (String) => Unit
  #setNewSendDOM      = undefined; // (String) => Unit
  #setNumClientsDOM   = undefined; // (String) => Unit
  #setNumCongestedDOM = undefined; // (String) => Unit
  #setStatusDOM       = undefined; // (String) => Unit

  // ( (String) => Unit, (String) => Unit, (String) => Unit, (String) => Unit, (String) => Unit
  // , () => Unit, () => Unit) => BandwidthManager
  constructor( setBandwidth, setNewSend, setNumClients, setNumCongested, setStatus
             , notifyCongested, notifyUncongested) {
    this.#congestionDuration = 0;
    this.#notifyCongested    = notifyCongested;
    this.#notifyUncongested  = notifyUncongested;
    this.#recentBuffers      = {};
    this.#setBandwidthDOM    = setBandwidth;
    this.#setNewSendDOM      = setNewSend;
    this.#setNumClientsDOM   = setNumClients;
    this.#setNumCongestedDOM = setNumCongested;
    this.#setStatusDOM       = setStatus;
  }

  // ((String) => Promise[Array[Number]]) => Unit
  updateBandwidth = (awaitSenders) => {

    const genStats = (msg, syncAmount, setDOM) => {
      awaitSenders(msg).then(
        (results) => {
          const asyncAmount = results.reduce(((acc, x) => acc + x), 0);
          const newText     = byteSizeLabel(syncAmount + asyncAmount, 2);
          setDOM(newText);
        }
      );
    };

    genStats("request-bandwidth-report", reportBandwidth(), this.#setBandwidthDOM);
    genStats("request-new-send"        , reportNewSend()  , this.#setNewSendDOM  );

  };

  // (Object[UUID, RTCDataChannel]) => Unit
  updateCongestionStats = (uuidToChannel) => {

    Object.entries(uuidToChannel).forEach(
      ([uuid, channel]) => {

        if (this.#recentBuffers[uuid] === undefined) {
          this.#recentBuffers[uuid] = [];
        }

        const bufferLog = this.#recentBuffers[uuid];
        bufferLog.push(channel.bufferedAmount);

        if (bufferLog.length > 8) {
          bufferLog.shift();
        }

      }
    );

    const numClients = Object.keys(uuidToChannel).length;

    const numCongested =
      Object.values(this.#recentBuffers).filter(
        (rb) => rb.filter((x) => x > 20000).length >= 5
      ).length;

    const allGoodStatus         = "All connections are uncongested";
    const minorCongestionStatus = `There is congestion for ${numCongested} client(s)`;
    const majorCongestionStatus = `There is congestion for ${numCongested} client(s); slowing simulation so they can catch up`;

    const connectionIsCongested = numCongested >= Math.max(1, numClients / 3);

    const status =
      (numCongested === 0)    ? allGoodStatus :
        connectionIsCongested ? minorCongestionStatus :
                                majorCongestionStatus;

    if (connectionIsCongested) {
      this.#notifyCongested();
      this.#congestionDuration++;
    } else {
      if (this.#congestionDuration > 0) {
        this.#notifyUncongested();
      }
      this.#congestionDuration = 0;
    }

    this.#setNumClientsDOM  (numClients);
    this.#setNumCongestedDOM(numCongested);
    this.#setStatusDOM      (status);

  };

}

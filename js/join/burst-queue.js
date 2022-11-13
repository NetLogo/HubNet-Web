import handleBurstMessage from "./handle-burst-message.js";

const Uninitialized = 1000;
const LoggedIn      = 2000;
const BootedUp      = 3000;

export default class BurstQueue {

  #handleBurst       = undefined; // (Object[Any]) => Unit
  #loop              = undefined; // (() => Unit) => Unit
  #loopIsTerminated  = undefined; // Boolean
  #messageQueue      = undefined; // Array[Object[Any]]
  #notifyDownloading = undefined; // () => Unit
  #notifyFailedInit  = undefined; // () => Unit
  #activityState     = undefined; // ActivityState
  #activityStateTS   = undefined; // Number

  // (Object[Any], (() => Unit) => Unit, () => Unit, () => Unit) => BurstQueue
  constructor(bundle, loop, notifyDownloading, notifyFailedInit) {

    const obj = { notifyBootedUp: () => { this.#setActivityState(BootedUp); } };

    this.#handleBurst       = handleBurstMessage({ ...bundle, ...obj });
    this.#loop              = loop;
    this.#loopIsTerminated  = false;
    this.#messageQueue      = [];
    this.#notifyDownloading = notifyDownloading;
    this.#notifyFailedInit  = notifyFailedInit;
    this.#activityState     = Uninitialized;
    this.#activityStateTS   = -1;

  }

  // (Object[Any]) => Unit
  enqueue = (x) => {
    this.#messageQueue.push(x);
  };

  // () => Unit
  halt = () => {
    this.#loopIsTerminated = true;
    this.#messageQueue     = [];
    this.setStateUninitialized();
  };

  // () => Unit
  run = () => {

    this.#loopIsTerminated = false;

    const innerLoop = () => {

      if (this.#activityState === LoggedIn) {

        if ((this.#activityStateTS + 60000) >= (new Date).getTime()) {

          let   stillGoing = true;
          const deferred   = [];

          while (stillGoing && this.#messageQueue.length > 0) {

            const message = this.#messageQueue.shift();

            if (message.type === "initial-model") {
              this.#notifyDownloading();
              this.#handleBurst(message);
              stillGoing = false;
            } else {
              deferred.push(message);
            }

          }

          deferred.forEach((d) => this.#messageQueue.push(d));

        } else {
          this.#notifyFailedInit();
        }

      } else if (this.#activityState === BootedUp) {
        while (this.#messageQueue.length > 0) {
          const message = this.#messageQueue.shift();
          this.#handleBurst(message);
        }
      } else {
        console.log("Skipping while in state:", this.#activityStateAsString());
      }

      if (!this.#loopIsTerminated) {
        this.#loop(innerLoop);
      }

    };

    innerLoop();

  };

  // () => Unit
  setStateLoggedIn = () => {
    this.#setActivityState(LoggedIn);
  };

  // () => Unit
  setStateUninitialized = () => {
    this.#setActivityState(Uninitialized);
  };

  // () => String
  #activityStateAsString = () => {
    switch (this.#activityState) {
      case Uninitialized: {
        return "uninitialized";
      }
      case LoggedIn: {
        return "logged in";
      }
      case BootedUp: {
        return "booted up";
      }
      default: {
        return "unknown";
      }
    }
  };

  // (ActivityState) => Unit
  #setActivityState = (state) => {
    this.#activityState   = state;
    this.#activityStateTS = (new Date).getTime();
  };

}

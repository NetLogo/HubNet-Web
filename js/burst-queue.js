import handleBurstMessage from "./handle-burst-message.js";

const Uninitialized = 1000;
const LoggedIn      = 2000;
const BootedUp      = 3000;

export default class BurstQueue {

  #bundle           = undefined; // Object[Any]
  #handleBurst      = undefined; // (Object[Any]) => Unit
  #loopIsTerminated = undefined; // Boolean
  #messageQueue     = undefined; // Array[Object[Any]]
  #pageState        = undefined; // PageState
  #pageStateTS      = undefined; // Number

  // () => BurstQueue
  constructor(burstBundle, myBundle) {

    const obj = { notifyBootedUp: this.setStateBootedUp };

    this.#bundle           = myBundle;
    this.#handleBurst      = handleBurstMessage({ ...burstBundle, ...obj });
    this.#loopIsTerminated = false;
    this.#messageQueue     = [];
    this.#pageState        = Uninitialized;
    this.#pageStateTS      = -1;

  }

  // (Object[Any]) => Unit
  enqueue = (x) => {
    this.#messageQueue.push(x);
  };

  // () => Unit
  halt = () => {
    this.#loopIsTerminated = true;
    this.setStateUninitialized();
  };

  // () => Unit
  run = () => {

    this.#loopIsTerminated = false;

    const innerLoop = () => {

      if (this.#pageState === LoggedIn) {

        if ((this.#pageStateTS + 60000) >= (new Date).getTime()) {

          let   stillGoing = true;
          const deferred   = [];

          while (stillGoing && this.#messageQueue.length > 0) {

            const message = this.#messageQueue.shift();

            if (message.type === "initial-model") {
              this.#bundle.notifyDownloading();
              this.#handleBurst(message);
              stillGoing = false;
            } else {
              deferred.push(message);
            }

          }

          deferred.forEach((d) => this.#messageQueue.push(d));

        } else {
          this.#bundle.notifyFailedInit();
        }

      } else if (this.#pageState === BootedUp) {
        while (this.#messageQueue.length > 0) {
          const message = this.#messageQueue.shift();
          this.#handleBurst(message);
        }
      } else {
        console.log("Skipping while in state:", this.#pageStateAsString());
      }

      if (!this.#loopIsTerminated) {
        this.#bundle.loop(innerLoop);
      }

    };

    innerLoop();

  };

  // () => Unit
  setStateBootedUp = () => {
    this.#setPageState(BootedUp);
  };

  // () => Unit
  setStateLoggedIn = () => {
    this.#setPageState(LoggedIn);
  };

  // () => Unit
  setStateUninitialized = () => {
    this.#setPageState(Uninitialized);
  };

  // () => String
  #pageStateAsString = () => {
    switch (this.#pageState) {
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

  // (PageState) => Unit
  #setPageState = (state) => {
    this.#pageState   = state;
    this.#pageStateTS = (new Date).getTime();
  };

}

import genWorker from "/js/common/worker.js";

// This was created because Safari does not support Workers spawning Workers.
//
// See this ticket (from 2009!) (and its linked issues) for more info:
// https://bugs.webkit.org/show_bug.cgi?id=25212
//
// --Jason B. (4/17/22)

// type WorkerLike[T] = Worker[T] | SafariNonWorker[T]

const checkUA = (name) => navigator.userAgent.includes(name);

const isSafari = checkUA("Safari") && !checkUA("Chrome");

class SafariNonWorker {

  #onmessage = () => {};  // (String) => Unit
  #promise   = undefined; // Promise[_]

  // (String) => SafariNonWorker[_]
  constructor(url) {
    console.log("We're using the Safari worker!");
    this.#promise = import(url).then((obj) => obj.default);
  }

  // (Object[Any]) => Unit
  notifyParent = (data) => {
    this.#onmessage(data);
  };

  // (Object[Any], Array[Any]) => Unit
  postMessage = (data, transfers) => {
    this.#promise.then(
      (obj) => {
        const message = new MessageEvent("message", { data, ports: transfers });
        obj.onmessage(message);
      }
    );
  };

  // () => Unit
  terminate = () => {
    this.#promise.then((obj) => obj.terminate());
  };

  // () => ((Object[Any]) => Unit)
  get onmessage() {
    return this.#onmessage;
  }

  // ((Object[Any]) => Unit) => Unit
  set onmessage(f) {
    this.#onmessage = f;
  }

}

// (String) => WorkerLike[_]
export default function genWorkerLike(url) {
  return !isSafari ? genWorker(url) : new SafariNonWorker(url);
}

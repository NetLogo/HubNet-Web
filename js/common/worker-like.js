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

  // (String, Object[String]) => SafariNonWorker[_]
  constructor(url, options) {
    console.log("We're using the Safari worker!");
    if (options.type === "module") {
      this.#promise = import(url).then((obj) => obj.default);
    } else {
      throw new Error("All Workers must be implemented as modules in order for Safari compatibility to work.  Please report this to the HubNet Web developers by e-mailing bugs@ccl.northwestern.edu .");
    }
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

// (String, Object[String]) => WorkerLike[_]
export default function genWorkerLike(url, options) {
  return !isSafari ? new Worker(url, options)
                   : new SafariNonWorker(url, options);
}

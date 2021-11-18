import { awaitWorker } from "/js/common/await.js";

export default class Base64Encoder {

  #worker = undefined; // Worker[Base64EncoderWorker]

  constructor() {
    this.#worker = new Worker("base64-encoder-worker.js", { type: "module" });
  }

  // (Blob) => Promise[String]
  encode = (blob) => {
    return awaitWorker(this.#worker)("encode-blob", { blob });
  };

}

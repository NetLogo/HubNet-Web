import { awaitWorker } from "/js/common/await.js";
import genWorker       from "/js/common/worker.js";

export default class Base64Encoder {

  #worker = undefined; // Worker[Base64EncoderWorker]

  constructor() {
    this.#worker = genWorker("base64-encoder-worker.js");
  }

  // (Blob) => Promise[String]
  encode = (blob) => {
    return awaitWorker(this.#worker)("encode-blob", { blob });
  };

}

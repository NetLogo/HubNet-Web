import { handleMessage, terminate } from "./xserializer-pool.js";

// (MessageEvent) => Unit
const onMsg =
  handleMessage("deserialize", "deserialize", "/js/serialize/deserializer.js", "deserializer");

/* eslint-disable no-undef */
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage    = onMsg;
  self.notifyParent = self.postMessage;
}
/* eslint-enable no-undef */

export default { onmessage: onMsg, terminate };

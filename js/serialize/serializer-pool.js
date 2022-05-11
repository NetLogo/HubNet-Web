import { handleMessage, terminate } from "./xserializer-pool.js";

// (MessageEvent) => Unit
const onMsg =
  handleMessage("serialize", "serialize", "/js/serialize/serializer.js", "serializer");

/* eslint-disable no-undef */
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage    = onMsg;
  self.notifyParent = self.postMessage;
}
/* eslint-enable no-undef */

export default { onmessage: onMsg, terminate };

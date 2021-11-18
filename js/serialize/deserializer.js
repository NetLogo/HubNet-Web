import { handleMessage } from "./xserializer.js";
import { deserialize   } from "./xserialize-root.js";

// (MessageEvent) => Unit
onmessage = handleMessage("deserializer", "deserialize", deserialize);

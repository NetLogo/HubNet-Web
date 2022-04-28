import { handleMessage } from "./xserializer-pool.js";

// (MessageEvent) => Unit
onmessage = handleMessage("deserialize", "deserialize", "/js/serialize/deserializer.js", "deserializer");

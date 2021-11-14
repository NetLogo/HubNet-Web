import { handleMessage } from "./xserializer-pool.js";

// (MessageEvent) => Unit
onmessage = handleMessage("deserialize", "deserialize", "deserializer.js", "deserializer");

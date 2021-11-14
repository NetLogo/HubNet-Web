import { handleMessage } from "./xserializer-pool.js";

// (MessageEvent) => Unit
onmessage = handleMessage("serialize", "serialize", "serializer.js", "serializer");

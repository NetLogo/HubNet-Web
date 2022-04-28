import { handleMessage } from "./xserializer-pool.js";

// (MessageEvent) => Unit
onmessage = handleMessage("serialize", "serialize", "/js/serialize/serializer.js", "serializer");

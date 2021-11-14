import { handleMessage } from "./xserializer.js";
import { serialize     } from "./xserialize-root.js";

// (MessageEvent) => Unit
onmessage = handleMessage("serializer", "serialize", serialize);

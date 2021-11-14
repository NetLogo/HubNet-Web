import { handleMessage } from "./coder.js";
import { decodePBuf    } from "./serializers.js";

// (MessageEvent) => Unit
onmessage = handleMessage("decoder", "decode", (x) => decodePBuf(!x));

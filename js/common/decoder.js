import { decodePBuf    } from "./converters.js";
import { handleMessage } from "./coder.js";

// (MessageEvent) => Unit
onmessage = handleMessage("decoder", "decode", (x) => decodePBuf(!x));

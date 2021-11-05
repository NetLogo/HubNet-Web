import { decodePBuf    } from "./converters-common.js";
import { handleMessage } from "./coder.js";

// (MessageEvent) => Unit
onmessage = handleMessage("decoder", "decode", decodePBuf);

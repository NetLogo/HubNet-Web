import { encodePBuf    } from "./converters.js";
import { handleMessage } from "./coder.js";

// (MessageEvent) => Unit
onmessage = handleMessage("encoder", "encode", encodePBuf);

import { encodePBuf    } from "./converters-common.js";
import { handleMessage } from "./coder.js";

// (MessageEvent) => Unit
onmessage = handleMessage("encoder", "encode", encodePBuf);

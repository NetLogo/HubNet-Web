import { handleMessage } from "./coder.js";
import { encodePBuf    } from "./serializers.js";

// (MessageEvent) => Unit
onmessage = handleMessage("encoder", "encode", encodePBuf);

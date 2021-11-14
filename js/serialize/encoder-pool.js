import { handleMessage } from "./coder-pool.js";

// (MessageEvent) => Unit
onmessage = handleMessage("encode", "encode", "encoder.js", "encoder");

import { handleMessage } from "./coder-pool.js";

// (MessageEvent) => Unit
onmessage = handleMessage("decode", "decode", "decoder.js", "decoder");

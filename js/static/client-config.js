// Resolves the per-deployment client config (the object the server emits at
// /js/config.js as `window.__HNW_CONFIG__`). On the main thread we read it
// straight off `window`. Inside a Web Worker there is no `window`, so
// `genWorker` (js/common/worker.js) forwards the config in the worker URL and we
// recover it here from `self.location`. Without this, every worker would fall
// back to the localhost dev defaults in domain.js/webrtc.js.

const fromWorkerLocation = () => {
  try {
    const raw = new URLSearchParams(self.location.search).get("hnwConfig");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const cfg =
     ((typeof window !== "undefined") && window.__HNW_CONFIG__)
  || ((typeof self   !== "undefined") && self.location && fromWorkerLocation())
  || {};

export default cfg;

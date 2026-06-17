// (String) => Worker[_]
export default function genWorker(url) {

  // Workers have no `window`, so domain.js/webrtc.js can't read
  // window.__HNW_CONFIG__ there and would fall back to localhost dev defaults.
  // Forward the config in the worker URL; client-config.js recovers it from
  // self.location inside the worker.
  const cfg     = (typeof window !== "undefined" && window.__HNW_CONFIG__) || {};
  const sep     = url.includes("?") ? "&" : "?";
  const fullURL = `${url}${sep}hnwConfig=${encodeURIComponent(JSON.stringify(cfg))}`;

  const worker = new Worker(fullURL, { type: "module" });

  worker.onerror = (e) => {
    console.error("Web Worker error!", e);
  };

  return worker;

}

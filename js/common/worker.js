// (String) => Worker[_]
export default function genWorker(url) {

  const worker = new Worker(url, { type: "module" });

  worker.onerror = (e) => {
    console.error("Web Worker error!", e);
  };

  return worker;

}

let iframe = document.querySelector("#nlw-frame > iframe");

iframe.onload = () => {
  const modelPath = '/assets/testland/Disease HubNet.nlogo'
  fetch(`${modelPath}.json`).then((x) => x.json()).then(
    (model) => {
      fetch(modelPath).then((x) => x.text()).then(
        (nlogo) => {
          iframe.contentWindow.postMessage({
            ...model
          , nlogo: nlogo
          , type: "hnw-become-oracle"
          }, "*");
        }
      )
    }
  );
};

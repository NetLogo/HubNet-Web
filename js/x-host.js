let iframe = document.querySelector("#nlw-frame > iframe");

iframe.onload = () => {
  fetch('/assets/testland/Disease HubNet.nlogo.json').then((x) => x.json()).then(
    (model) => {
      iframe.contentWindow.postMessage({
        ...model
      , type: "hnw-become-oracle"
      }, "*");
    }
  );
};

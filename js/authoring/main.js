import { galapagos, galaProto } from "/js/static/domain.js";

const url   = `${galaProto}://${galapagos}/hnw/authoring?embedded=true`;
const frame = document.getElementById("embed-frame");

frame.onload = () => {

  if (window.location.hash.length > 1) {

    const modelName = window.location.hash.slice(1);
    const nlogoName = `${modelName} HubNet.nlogo`;

    const nlogoP = fetch(`/models/${nlogoName}`     ).then((res) => res.text());
    const  jsonP = fetch(`/models/${nlogoName}.json`).then((res) => res.json());

    Promise.all([nlogoP, jsonP]).then(
      ([nlogo, config]) => {
        const msg = { type: "hnw-author-pair", nlogo, config };
        frame.contentWindow.postMessage(msg, "*");
      }
    );

  }

};

frame.src = url;

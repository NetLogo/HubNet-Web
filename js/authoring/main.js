import { galapagos, galaProto } from "/js/static/domain.js";

const url   = `${galaProto}://${galapagos}/hnw/authoring?embedded=true`;
const frame = document.getElementById("embed-frame");

frame.onload = async () => {

  if (window.location.hash.length > 1) {

    const modelName = window.location.hash.slice(1);
    const nlogoName = `${modelName} HubNet.nlogox`;

    const nlogox = await fetch(`/models/${nlogoName}`).then((res) => res.text());
    const msg    = { type: "hnw-author", nlogox };
    frame.contentWindow.postMessage(msg, "*");

  }

};

frame.src = url;

import { galapagos, galaProto } from "/js/static/domain.js";

const url   = `${galaProto}://${galapagos}/hnw/authoring?embedded=true`;
const frame = document.getElementById("embed-frame");
frame.src   = url;

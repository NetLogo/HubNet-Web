import Base64Encoder from "./base64-encoder.js";

import WebSocketManager from "/js/common/websocket.js";

let persistentPops = null; // Array[Number]
let lastMemberInfo = null; // Array[Number]
let socket         = null; // WebSocketManager

const encoder = new Base64Encoder();

// (Array[Number], Array[Number]) => Array[Number]
const addArrays = (xs, ys) => {

  if (xs.length !== ys.length) {
    console.warn("Adding mismatched role arrays", xs, ys);
  }

  return xs.map((x, i) => x + ys[i]);

};

// (MessageEvent) => Unit
onmessage = (e) => {

  switch (e.data.type) {

    case "connect": {
      socket = new WebSocketManager(e.data.url);
      break;
    }

    case "image-update": {
      encoder.encode(e.data.blob).then(
        (base64) => {
          socket.send("image-update", { base64 });
        }
      );
      break;
    }

    case "persistent-pops": {
      persistentPops = e.data.pops;
      break;
    }

    case "request-new-send": {
      e.ports[0].postMessage(socket.getNewSend());
      break;
    }

    case "request-bandwidth-report": {
      e.ports[0].postMessage(socket.getBandwidth());
      break;
    }

    case "role-config": {
      const convArr  = (arr) => btoa(String.fromCharCode(...arr));
      const convData = (  r) => ({ ...r, data: convArr(r.data) });
      const roles    = e.data.roles.map(convData);
      socket.send("role-config", { roles });
      break;
    }

    case "role-populations": {

      const minfo = e.data.rolePopulations;

      if (lastMemberInfo === null                ||
          lastMemberInfo.length !== minfo.length ||
          lastMemberInfo.some((x, i) => x !== minfo[i])) {

        lastMemberInfo = minfo;

        if (persistentPops !== null) {
          const finfo = addArrays(minfo, persistentPops);
          socket.send("members-update", { memberInfo: finfo });
        }

      }

      break;

    }

    default: {
      console.warn("Unknown status socket message type:", e.data.type, e);
    }

  }

};

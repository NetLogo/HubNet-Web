import { deepClone, recombobulateToken, rejiggerToken } from "./common-jiggery-pokery.js"

// (Object[Any]) => Object[Any]
const rejiggerConnEst = (obj) => {

  const out = deepClone(obj);

  const regex                    = /(\d+)\.(\d+)\.(\d+)/;
  const version                  = out.protocolVersion;
  const [_, major, minor, patch] = version.match(regex);

  out.protocolMajor = major;
  out.protocolMinor = minor;
  out.protocolPatch = patch;

  return out;

};

// (Object[Any]) => Object[Any]
const rejiggerRelay = (obj) => {

  const out = {};
  for (let k0 in obj) {

    const v0 = obj[k0];
    if (k0 === "payload") {

      out[k0] = {};
      for (let k1 in v0) {

        const v1 = v0[k1];
        if (k1 === "token") {
          rejiggerToken(v1, out[k0]);
        } else if (k1 === "event") {

          out[k0][k1] = {};

          // Rejigger relay.payload.event[type="raincheck"]
          if (v1.type === "hnw-cash-raincheck") {
            out[k0][k1].hnwCashRaincheckPayload = {}; // Rename
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") { // Ignore `type`
                out[k0][k1].hnwCashRaincheckPayload[k2] = v2;
              }
            }
          } else {
            for (let k2 in v1) {
              const v2 = v1[k2];
              out[k0][k1][k2] = v2;
            }
          }

        } else if (k1 === "data") {

          out[k0][k1] = {};

          // Rejigger relay.payload.data[type="button"]
          if (v1.type === "button") {
            out[k0][k1].hnwButtonPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwButtonPayload[k2] = v2;
              }
            }
          } else if (v1.type === "chooser") {
            out[k0][k1].hnwChooserPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwChooserPayload[k2] = v2;
              }
            }
          // BAD: input
          } else if (v1.type === "input78") {
            out[k0][k1].hnwInputNumberPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwInputNumberPayload[k2] = v2;
              }
            }
          } else if (v1.type === "input") {
            out[k0][k1].hnwInputStringPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwInputStringPayload[k2] = v2;
              }
            }
          // BAD: mouse
          } else if (v1.type === "mouse-up") {
            out[k0][k1].hnwMouseUpPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwMouseUpPayload[k2] = v2;
              }
            }
          // BAD: mouse
          } else if (v1.type === "mouse-down") {
            out[k0][k1].hnwMouseDownPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwMouseDownPayload[k2] = v2;
              }
            }
          // BAD: mouse
          } else if (v1.type === "mouse-move") {
            out[k0][k1].hnwMouseMovePayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwMouseMovePayload[k2] = v2;
              }
            }
          } else if (v1.type === "slider") {
            out[k0][k1].hnwSliderPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwSliderPayload[k2] = v2;
              }
            }
          } else if (v1.type === "switch") {
            out[k0][k1].hnwSwitchPayload = {};
            for (let k2 in v1) {
              const v2 = v1[k2];
              if (k2 !== "type") {
                out[k0][k1].hnwSwitchPayload[k2] = v2;
              }
            }
          } else {
            for (let k2 in v1) {
              const v2 = v1[k2];
              out[k0][k1][k2] = v2;
            }
          }

        } else {
          out[k0][k1] = v1;
        }

      }

    } else {
      out[k0] = v0;
    }

  }

  return out;

};

// (Object[Any]) => Object[Any]
const recombobulateConnEst = (obj) => {
  const out           = deepClone(obj);
  out.protocolVersion = `${out.protocolMajor}.${out.protocolMinor}.${out.protocolPatch}`
  return out;
};

// (Object[Any]) => Object[Any]
const recombobulateRelay = (obj) => {

  const out = {};
  for (let k0 in obj) {

    const v0 = obj[k0];
    if (k0 === "payload") {

      out[k0] = {};

      recombobulateToken(v0, out[k0]);

      for (let k1 in v0) {

        const v1 = v0[k1];
        if (k1 === "event") {

          out[k0][k1] = {};
          for (let k2 in v1) {

            // recombobulate relay.payload.event.hnwCashRaincheckPayload
            if (k2 === "hnwCashRaincheckPayload") {
              out[k0][k1].type = "hnw-cash-raincheck";
              for (let k3 in v1) {
                out[k0][k1][k3] = v1[k2][k3];
              }
            } else {
              out[k0][k1][k2] = v1[k2];
            }

          }

        } else if (k1 === "data") {

          out[k0][k1] = {};

          for (let k2 in v1) {

            // Rejigger relay.payload.hnwButtonPayload
            if (k2 === "hnwButtonPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "button";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwChooserPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "chooser";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwInputNumberPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "input78";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwInputStringPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "input";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwMouseUpPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "mouse-up";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwMouseDownPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "mouse-down";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwMouseMovePayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "mouse-move";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwSliderPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "slider";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else if (k2 === "hnwSwitchPayload") {
              const v2 = v1[k2];
              out[k0][k1].type = "switch";
              for (let k3 in v2) {
                out[k0][k1][k3] = v2[k3];
              }
            } else {
              out[k0][k1][k2] = v1[k2];
            }

          }

        } else {
          out[k0][k1] = v1;
        }

      }

    } else {
      out[k0] = v0;
    }

  }

  return out;

};

// (Object[Any]) => Object[Any]
const rejigger = (msg) => {
  switch (msg.type) {
    case "connection-established":
      return rejiggerConnEst(msg);
      break;
    case "relay":
      return rejiggerRelay(msg);
      break;
    default:
      return deepClone(msg);
  }
};

// (Object[Any]) => Object[Any]
const recombobulate = (msg) => {
  switch (msg.type) {
    case "connection-established":
      return recombobulateConnEst(msg);
      break;
    case "relay":
      return recombobulateRelay(msg);
      break;
    default:
      return deepClone(msg);
  }
};

export { recombobulate, rejigger }

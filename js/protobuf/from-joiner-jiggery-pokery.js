import { deepClone, recombobulateToken, rejiggerToken, transform } from "./common-jiggery-pokery.js"

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

          // Rejigger relay.payload.event[type="raincheck"], etc.
          if (v1.type === "hnw-cash-raincheck") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwCashRaincheckPayload = replacement;
          } else {
            out[k0][k1] = deepClone(v1);
          }

        } else if (k1 === "data") {

          out[k0][k1] = {};

          // Rejigger relay.payload.data[type="button"], etc.
          if (v1.type === "button") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwButtonPayload = replacement;
          } else if (v1.type === "chooser") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwChooserPayload = replacement;
          // BAD: input
          } else if (v1.type === "input78") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwInputNumberPayload = replacement;
          } else if (v1.type === "input") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwInputStringPayload = replacement;
          // BAD: mouse
          } else if (v1.type === "mouse-up") {
            const replacement = deepClone(v1, { type: 1 });
            transform(replacement)("xcor", (x) => Math.round(x * 10));
            transform(replacement)("ycor", (y) => Math.round(y * 10));
            out[k0][k1].hnwMouseUpPayload = replacement;
          // BAD: mouse
          } else if (v1.type === "mouse-down") {
            const replacement = deepClone(v1, { type: 1 });
            transform(replacement)("xcor", (x) => Math.round(x * 10));
            transform(replacement)("ycor", (y) => Math.round(y * 10));
            out[k0][k1].hnwMouseDownPayload = replacement;
          // BAD: mouse
          } else if (v1.type === "mouse-move") {
            const replacement = deepClone(v1, { type: 1 });
            transform(replacement)("xcor", (x) => Math.round(x * 10));
            transform(replacement)("ycor", (y) => Math.round(y * 10));
            out[k0][k1].hnwMouseMovePayload = replacement;
          } else if (v1.type === "slider") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwSliderPayload = replacement;
          } else if (v1.type === "switch") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwSwitchPayload = replacement;
          } else {
            out[k0][k1] = deepClone(v1);
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

            // recombobulate relay.payload.event.hnwCashRaincheckPayload, etc.
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

            // Rejigger relay.payload.hnwButtonPayload, etc.
            if (k2 === "hnwButtonPayload") {
              out[k0][k1] = { type: "button", ...deepClone(v1[k2]) };
            } else if (k2 === "hnwChooserPayload") {
              out[k0][k1] = { type: "chooser", ...deepClone(v1[k2]) };
            } else if (k2 === "hnwInputNumberPayload") {
              out[k0][k1] = { type: "input78", ...deepClone(v1[k2]) };
            } else if (k2 === "hnwInputStringPayload") {
              out[k0][k1] = { type: "input", ...deepClone(v1[k2]) };
            } else if (k2 === "hnwMouseUpPayload") {
              out[k0][k1] = { type: "mouse-up", ...deepClone(v1[k2]) };
              transform(out[k0][k1])("xcor", (x) => x / 10);
              transform(out[k0][k1])("ycor", (y) => y / 10);
            } else if (k2 === "hnwMouseDownPayload") {
              out[k0][k1] = { type: "mouse-down", ...deepClone(v1[k2]) };
              transform(out[k0][k1])("xcor", (x) => x / 10);
              transform(out[k0][k1])("ycor", (y) => y / 10);
            } else if (k2 === "hnwMouseMovePayload") {
              out[k0][k1] = { type: "mouse-move", ...deepClone(v1[k2]) };
              transform(out[k0][k1])("xcor", (x) => x / 10);
              transform(out[k0][k1])("ycor", (y) => y / 10);
            } else if (k2 === "hnwSliderPayload") {
              out[k0][k1] = { type: "slider", ...deepClone(v1[k2]) };
            } else if (k2 === "hnwSwitchPayload") {
              out[k0][k1] = { type: "switch", ...deepClone(v1[k2]) };
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
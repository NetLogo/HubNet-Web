import { deepClone, recombobulateToken, rejiggerToken } from "./common-jiggery-pokery.js";

// (Object[Any]) => Object[Any]
const rejiggerConnEst = (obj) => {

  const out = deepClone(obj);

  const regex                    = /(\d+)\.(\d+)\.(\d+)/;
  const version                  = out.protocolVersion;
  const [ , major, minor, patch] = version.match(regex);

  out.protocolMajor = major;
  out.protocolMinor = minor;
  out.protocolPatch = patch;

  return out;

};

// (Object[Any]) => Object[Any]
const rejiggerRelay = (obj) => {

  const out = {};
  for (const k0 in obj) {

    const v0 = obj[k0];
    if (k0 === "payload") {

      out[k0] = {};
      for (const k1 in v0) {

        const v1 = v0[k1];
        if (k1 === "token") {
          rejiggerToken(v1, out[k0]);
        } else if (k1 === "event") {
          out[k0][k1] = deepClone(v1);
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
          } else if (v1.type === "view") {
            const replacement = deepClone(v1, { type: 1 });
            const subtype     = replacement.message.subtype;
            replacement.xcor  = Math.round(replacement.message.xcor * 10);
            replacement.ycor  = Math.round(replacement.message.ycor * 10);
            const k2 = (subtype === "mouse-up"  ) ? "hnwMouseUpPayload"   :
                      ((subtype === "mouse-down") ? "hnwMouseDownPayload" :
                                                    "hnwMouseMovePayload");
            delete replacement.message;
            out[k0][k1][k2] = replacement;
          } else if (v1.type === "slider") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwSliderPayload = replacement;
          } else if (v1.type === "switch") {
            const replacement = deepClone(v1, { type: 1 });
            out[k0][k1].hnwSwitchPayload = replacement;
          } else {
            out[k0][k1] = deepClone(v1);
          }
        } else if (v0.type === "hnw-cash-raincheck") {
          out[k0].hnwCashRaincheckPayload = { id: v0.id };
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
  const major         = out.protocolMajor;
  const minor         = out.protocolMinor;
  const patch         = out.protocolPatch;
  out.protocolVersion = `${major}.${minor}.${patch}`;
  return out;
};

// (Object[Any]) => Object[Any]
const recombobulateRelay = (obj) => {

  const out = {};
  for (const k0 in obj) {

    const v0 = obj[k0];
    if (k0 === "payload") {

      out[k0] = {};

      recombobulateToken(v0, out[k0]);

      for (const k1 in v0) {

        const v1 = v0[k1];
        if (k1 === "event") {
          out[k0][k1] = {};
          for (const k2 in v1) {
            out[k0][k1][k2] = v1[k2];
          }
        } else if (k1 === "data") {

          out[k0][k1] = {};

          for (const k2 in v1) {

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
              const xcor    = v1[k2].xcor / 10;
              const ycor    = v1[k2].ycor / 10;
              const message = { subtype: "mouse-up", xcor, ycor };
              out[k0][k1]   = { type: "view", message };
            } else if (k2 === "hnwMouseDownPayload") {
              const xcor    = v1[k2].xcor / 10;
              const ycor    = v1[k2].ycor / 10;
              const message = { subtype: "mouse-down", xcor, ycor };
              out[k0][k1]   = { type: "view", message };
            } else if (k2 === "hnwMouseMovePayload") {
              const xcor    = v1[k2].xcor / 10;
              const ycor    = v1[k2].ycor / 10;
              const message = { subtype: "mouse-move", xcor, ycor };
              out[k0][k1]   = { type: "view", message };
            } else if (k2 === "hnwSliderPayload") {
              out[k0][k1] = { type: "slider", ...deepClone(v1[k2]) };
            } else if (k2 === "hnwSwitchPayload") {
              out[k0][k1] = { type: "switch", ...deepClone(v1[k2]) };
            } else {
              out[k0][k1][k2] = v1[k2];
            }

          }

        } else if (k1.startsWith("tokenChunk")) {
          // Ignore these; they are assembled into `token` --Jason B. (11/3/21)
        } else if (k1 === "hnwCashRaincheckPayload") {
          out[k0].type = "hnw-cash-raincheck";
          for (const k2 in v1) {
            out[k0][k2] = v1[k2];
          }
          console.log("Recombob rain", k1, v1, out[k0][k1]);
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
    case "connection-established": {
      return rejiggerConnEst(msg);
    }
    case "relay": {
      return rejiggerRelay(msg);
    }
    default: {
      return deepClone(msg);
    }
  }
};

// (Object[Any]) => Object[Any]
const recombobulate = (msg) => {
  switch (msg.type) {
    case "connection-established": {
      return recombobulateConnEst(msg);
    }
    case "relay": {
      return recombobulateRelay(msg);
    }
    default: {
      return deepClone(msg);
    }
  }
};

export { recombobulate, rejigger };

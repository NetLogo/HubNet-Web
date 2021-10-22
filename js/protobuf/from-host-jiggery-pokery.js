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
const rejiggerBurst = (obj) => {

  const out = deepClone(obj);

  if (out.fullLength === 1) {
    out.isMicroBurst = true;
    delete out.fullLength;
    delete out.index;
  }

  return out;

};

// (Object[Any], Object[Any]) => Object[Any]
const rejiggerLinks = (links, parent) => {
  Object.entries(links).forEach(
    ([who, link]) => {

      const l     = deepClone(link, {}, true);
      const xform = transform(l);

      xform("color"      , (c) => Math.floor(c * 10));
      xform("heading"    , (h) => Math.round(h     ));
      xform("label-color", (c) => Math.floor(c * 10));
      xform("midpointx"  , (x) => Math.round(x * 10));
      xform("midpointy"  , (y) => Math.round(y * 10));

      parent[who] = l;

    }
  );
};

// (Object[Any], Object[Any]) => Object[Any]
const rejiggerPatches = (patches, parent) => {
  Object.entries(patches).forEach(
    ([who, patch]) => {

      const p     = deepClone(patch, {}, true);
      const xform = transform(p);

      xform("pcolor"      , (c) => Math.floor(c * 10));
      xform("plabel-color", (c) => Math.floor(c * 10));
      xform("pxcor"       , (x) => Math.round(x * 10));
      xform("pycor"       , (y) => Math.round(y * 10));

      parent[who] = p;

    }
  );
};

// (Object[Any], Object[Any]) => Object[Any]
const rejiggerTurtles = (turtles, parent) => {
  Object.entries(turtles).forEach(
    ([who, turtle]) => {

      const t     = deepClone(turtle, {}, true);
      const xform = transform(t);

      xform("color"      , (c) => Math.floor(c * 10));
      xform("heading"    , (h) => Math.round(h     ));
      xform("label-color", (c) => Math.floor(c * 10));
      xform("xcor"       , (x) => Math.round(x * 10));
      xform("ycor"       , (y) => Math.round(y * 10));

      parent[who] = t;

    }
  );
};

// (Object[Any], Object[Any]) => Object[Any]
const rejiggerViewUpdates = (target, parent) => {
  for (let k0 in target) {
    const v0 = target[k0];
    if (k0 === "links") {
      parent[k0] = {};
      rejiggerLinks(v0, parent[k0]);
    } else if (k0 === "patches") {
      parent[k0] = {};
      rejiggerPatches(v0, parent[k0]);
    } else if (k0 === "turtles") {
      parent[k0] = {};
      rejiggerTurtles(v0, parent[k0]);
    } else if (k0 === "world") {
      parent[k0] = deepClone(v0, {}, true, { editableColorIndex: true });
    } else if (k0 === "observer") {
      parent[k0] = deepClone(v0, {}, true);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any], Object[Any]) => Object[Any]
const rejiggerPlotUpdates = (target, parent) => {

  for (let k0 in target) {

    const newPupdates = [];
    parent[k0]        = newPupdates;

    for (let k1 in target[k0]) {
      const pupdate = target[k0][k1];
      // Rejigger *.plotUpdates > *[type="add-point"], etc.
      if (pupdate.type === "add-point") {
        const outer = { addPoint: deepClone(pupdate, { type: 1 }) };
        transform(outer.addPoint)("x", (x) => Math.round(x * 10));
        transform(outer.addPoint)("y", (y) => Math.round(y * 10));
        newPupdates.push(outer);
      } else if (pupdate.type === "reset") {
        const outer = { reset: deepClone(pupdate, { type: 1 }) };
        newPupdates.push(outer);
      } else if (pupdate.type === "reset-pen") {
        const outer = { resetPen: deepClone(pupdate, { type: 1 }) };
        newPupdates.push(outer);
      } else if (pupdate.type === "register-pen") {
        const outer = { registerPen: deepClone(pupdate, { type: 1 }) };
        transform(outer.registerPen)("color", (c) => Math.floor(c * 10));
        newPupdates.push(outer);
      } else if (pupdate.type === "update-pen-color") {
        const outer = { updatePenColor: deepClone(pupdate, { type: 1 }) };
        transform(outer.updatePenColor)("color", (c) => Math.floor(c * 10));
        newPupdates.push(outer);
      } else if (pupdate.type === "update-pen-mode") {
        const outer = { updatePenMode: deepClone(pupdate, { type: 1 }) };
        newPupdates.push(outer);
      } else {
        console.warn("Impossible type for pupdate!", pupdate);
      }
    }

  }

};

// (Object[Any]) => Object[Any]
const rejiggerInitialModel = (obj) => {

  const out = {};
  for (let k0 in obj) {

    const v0 = obj[k0];

    if (k0 === "token") {
      rejiggerToken(v0, out);
    } else if (k0 === "role") {

      out[k0] = {};
      for (let k1 in v0) {

        const v1 = v0[k1];
        if (k1 === "widgets") {

          out[k0][k1] = [];

          for (let k2 in v1) {

            const widget = v1[k2];

            // Rejigger initial-model.role.widgets > [type="button"], etc.
            if (widget.type === "hnwButton") {
              const outer = { button: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwChooser") {
              const outer = { chooser: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwInputBox") {
              const outer = { inputBox: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwMonitor") {
              const outer = { monitor: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwOutput") {
              const outer = { output: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwPlot") {

              const outer = { plot: deepClone(widget, { type: 1 }) };

              transform(outer.plot)("xmin", (x) => Math.round(x * 10));
              transform(outer.plot)("xmax", (x) => Math.round(x * 10));
              transform(outer.plot)("ymin", (y) => Math.round(y * 10));
              transform(outer.plot)("ymax", (y) => Math.round(y * 10));

              const pens = Object.values(outer.plot.pens);
              pens.forEach(
                (pen) =>
                  transform(pen)("interval", (i) => Math.round(i * 100))
              );

              out[k0][k1].push(outer);

            } else if (widget.type === "hnwSlider") {
              const outer = { slider: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwSwitch") {
              const outer = { switch: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwTextBox") {
              const outer = { textBox: deepClone(widget, { type: 1 }) };
              transform(outer.textBox)("color", (c) => Math.floor(c * 10));
              out[k0][k1].push(outer);
            } else if (widget.type === "hnwView") {
              const outer = { view: deepClone(widget, { type: 1 }) };
              out[k0][k1].push(outer);
            } else {
              console.log("This widget type shouldn't be possible...", widget);
            }
          }

        } else {
          out[k0][k1] = v1;
        }

      }

    } else if (k0 === "state") {
      out[k0] = {};
      rejiggerStateUpdateInner(v0, out[k0]);
    } else {
      out[k0] = v0;
    }

  }

  return out;

};

// (Object[Any]) => Object[Any]
const rejiggerRelay = (obj) => {

  const out = {};
  for (let k0 in obj) {

    const v0 = obj[k0];
    if (k0 === "payload") {

      out[k0] = {};

      // Rejigger relay.payload.data[type="ticks-started"], etc.
      if (v0.type === "ticks-started") {
        const outer = { hnwTicksStarted: deepClone(v0, { type: 1 }) };
        out[k0] = outer;
      } else {
        out[k0] = deepClone(v0);
      }

    } else {
      out[k0] = v0;
    }

  }

  return out;

};

// (Object[Any]) => Object[Any]
const rejiggerStateUpdateInner = (target, parent) => {
  for (let k0 in target) {
    const v0 = target[k0];
    if (k0 === "viewUpdate") {
      parent[k0] = {};
      rejiggerViewUpdates(v0, parent[k0]);
    } else if (k0 === "plotUpdates") {
      parent[k0] = {};
      rejiggerPlotUpdates(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any]) => Object[Any]
const rejiggerStateUpdate = (obj) => {

  const out = {};

  for (let k0 in obj) {
    const v0 = obj[k0];
    if (k0 === "update") {
      out[k0] = {};
      rejiggerStateUpdateInner(v0, out[k0]);
    } else {
      out[k0] = deepClone(v0);
    }
  }

  return out;

};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulateLinks = (links, parent) => {
  Object.entries(links).forEach(
    ([who, link]) => {

      const l     = deepClone(link);
      const xform = transform(l);

      xform("color"      , (c) => c / 10);
      xform("label-color", (c) => c / 10);
      xform("midpointx"  , (x) => x / 10);
      xform("midpointy"  , (y) => y / 10);

      parent[who] = l;

    }
  );
};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulatePatches = (patches, parent) => {
  Object.entries(patches).forEach(
    ([who, patch]) => {

      const p     = deepClone(patch);
      const xform = transform(p);

      xform("pcolor"      , (c) => c / 10);
      xform("plabel-color", (c) => c / 10);
      xform("pxcor"       , (x) => x / 10);
      xform("pycor"       , (y) => y / 10);

      parent[who] = p;

    }
  );
};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulateTurtles = (turtles, parent) => {
  Object.entries(turtles).forEach(
    ([who, turtle]) => {

      const t     = deepClone(turtle);
      const xform = transform(t);

      xform("color"      , (c) => c / 10);
      xform("label-color", (c) => c / 10);
      xform("xcor"       , (x) => x / 10);
      xform("ycor"       , (y) => y / 10);

      parent[who] = t;

    }
  );
};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulateViewUpdates = (target, parent) => {
  for (let k0 in target) {
    const v0 = target[k0];
    if (k0 === "links") {
      parent[k0] = {};
      recombobulateLinks(v0, parent[k0]);
    } else if (k0 === "patches") {
      parent[k0] = {};
      recombobulatePatches(v0, parent[k0]);
    } else if (k0 === "turtles") {
      parent[k0] = {};
      recombobulateTurtles(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any]) => Object[Any]
const recombobulateConnEst = (obj) => {
  const out           = deepClone(obj);
  out.protocolVersion = `${out.protocolMajor}.${out.protocolMinor}.${out.protocolPatch}`
  return out;
};

// (Object[Any]) => Object[Any]
const recombobulateBurst = (obj) => {

  const out = deepClone(obj);

  if (out.isMicroBurst) {
    out.index      = 0;
    out.fullLength = 1;
    delete out.isMicroBurst;
  }

  return out;

};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulatePlotUpdates = (target, parent) => {

  for (let k0 in target) {

    const newPupdates = [];
    parent[k0]        = newPupdates;

    for (let pupdate in target[k0]) {

      // recombobulate *.plotUpdates > *{ addPoint }, etc.
      if (pupdate.addPoint !== undefined) {
        const inner = pupdate.addPoint;
        const out   = { type: "add-point", ...deepClone(inner) };
        transform(out)("x", (x) => x / 10);
        transform(out)("y", (y) => y / 10);
        newPupdates.push(out);
      } else if (pupdate.reset !== undefined) {
        const inner = pupdate.reset;
        newPupdates.push({ type: "reset", ...inner });
      } else if (pupdate.resetPen !== undefined) {
        const inner = pupdate.resetPen;
        newPupdates.push({ type: "reset-pen", ...inner });
      } else if (pupdate.registerPen !== undefined) {
        const inner   = pupdate.registerPen;
        const out     = { type: "register-pen", ...deepClone(inner) };
        transform(out.pen)("color", (c) => c / 10);
        newPupdates.push(out);
      } else if (pupdate.updatePenColor !== undefined) {
        const inner = pupdate.updatePenColor;
        const out   = { type: "update-pen-color", ...deepClone(inner) };
        transform(out)("color", (c) => c / 10);
        newPupdates.push(out);
      } else if (pupdate.updatePenMode !== undefined) {
        const inner = pupdate.updatePenMode;
        newPupdates.push({ type: "update-pen-mode", ...inner });
      } else {
        console.warn("Impossible type for pupdate!", pupdate);
      }

    }

  }

};

// (Object[Any]) => Object[Any]
const recombobulateInitialModel = (obj) => {

  const out = {};

  recombobulateToken(obj, out);

  for (let k0 in obj) {

    const v0 = obj[k0];

    if (k0 === "role") {

      out[k0] = {};
      for (let k1 in v0) {

        const v1 = v0[k1];
        if (k1 === "widgets") {

          out[k0][k1] = [];

          // Recombobulate initial-model.role.widgets > *, etc.
          for (let k2 in v1) {

            const widget = v1[k2];

            if (widget.button !== undefined) {
              const inner = widget.button;
              out[k0][k1].push({ type: "hnwButton", ...inner });
            } else if (widget.chooser !== undefined) {
              const inner = widget.chooser;
              out[k0][k1].push({ type: "hnwChooser", ...inner });
            } else if (widget.inputBox !== undefined) {
              const inner = widget.inputBox;
              out[k0][k1].push({ type: "hnwInputBox", ...inner });
            } else if (widget.monitor !== undefined) {
              const inner = widget.monitor;
              out[k0][k1].push({ type: "hnwMonitor", ...inner });
            } else if (widget.output !== undefined) {
              const inner = widget.output;
              out[k0][k1].push({ type: "hnwOutput", ...inner });
            } else if (widget.plot !== undefined) {

              const inner   = deepClone(widget.plot);
              const newPlot = { type: "hnwPlot", ...inner }

              transform(newPlot)("xmin", (x) => x / 10);
              transform(newPlot)("xmax", (x) => x / 10);
              transform(newPlot)("ymin", (y) => y / 10);
              transform(newPlot)("ymax", (y) => y / 10);

              newPlot.pens = newPlot.pens || {};

              const pens = Object.values(newPlot.pens);
              pens.forEach(
                (pen) =>
                  transform(pen)("interval", (i) => i / 100)
              );

              out[k0][k1].push(newPlot);

            } else if (widget.slider !== undefined) {
              const inner = widget.slider;
              out[k0][k1].push({ type: "hnwSlider", ...inner });
            } else if (widget.switch !== undefined) {
              const inner = widget.switch;
              out[k0][k1].push({ type: "hnwSwitch", ...inner });
            } else if (widget.textBox !== undefined) {
              const inner       = widget.textBox;
              const replacement = { type: "hnwTextBox", ...deepClone(inner) };
              transform(replacement)("color", (c) => c / 10);
              out[k0][k1].push(replacement);
            } else if (widget.view !== undefined) {
              const inner  = deepClone(widget.view);
              inner.height = inner.bottom - inner.top;
              inner.width  = inner.right  - inner.left;
              out[k0][k1].push({ type: "hnwView", ...inner });
            } else {
              console.warn("Well, that's impressive.  What widget type could this be?", widget);
            }

          }

        } else {
          out[k0][k1] = v1;
        }

      }

    } else if (k0 === "state") {
      out[k0] = {};
      recombobulateStateUpdateInner(v0, out[k0]);
    } else {
      out[k0] = v0;
    }

  }

  return out;

};

// (Object[Any]) => Object[Any]
const recombobulateRelay = (obj) => {

  const out = {};
  for (let k0 in obj) {

    const v0 = obj[k0];
    if (k0 === "payload") {

      out[k0] = {};
      for (let k1 in v0) {

        const v1 = v0[k1];

        // Recombobulate relay.payload.hnwTicksStarted, etc.
        if (k1 === "hnwTicksStarted") {
          out[k0][k1] = { type: "ticks-started", ...deepClone(v1) };
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
const recombobulateStateUpdateInner = (target, parent) => {
  for (let k0 in target) {
    const v0 = target[k0];
    if (k0 === "viewUpdate") {
      parent[k0] = {};
      recombobulateViewUpdates(v0, parent[k0]);
    } else if (k0 === "plotUpdates") {
      parent[k0] = {};
      recombobulatePlotUpdates(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any]) => Object[Any]
const recombobulateStateUpdate = (obj) => {

  const out = {};

  for (let k0 in obj) {
    const v0 = obj[k0];
    if (k0 === "update") {
      out[k0] = {};
      recombobulateStateUpdateInner(v0, out[k0]);
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
    case "hnw-burst":
      return rejiggerBurst(msg);
      break;
    case "initial-model":
      return rejiggerInitialModel(msg);
      break;
    case "relay":
      return rejiggerRelay(msg);
      break;
    case "state-update":
      return rejiggerStateUpdate(msg);
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
    case "hnw-burst":
      return recombobulateBurst(msg);
      break;
    case "initial-model":
      return recombobulateInitialModel(msg);
      break;
    case "relay":
      return recombobulateRelay(msg);
      break;
    case "state-update":
      return recombobulateStateUpdate(msg);
      break;
    default:
      return deepClone(msg);
  }
};

export { recombobulate, rejigger }

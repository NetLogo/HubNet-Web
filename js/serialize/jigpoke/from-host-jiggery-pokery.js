import { deepClone, recombobulateToken, rejiggerToken, transform } from "./common-jiggery-pokery.js";

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
const rejiggerHostAnswer = (obj) => {
  const out = deepClone(obj);
  out.answer.answerType = out.answer.type;
  delete out.answer.type;
  return out;
};

// (Object[Any], Number|Array[Number]) => Unit
const rejiggerColor = (target, key) => {

  const initColor = target[key];

  if (initColor !== undefined) {
    if (typeof(initColor) === "number") {
      target[key] = Math.floor(initColor * 10);
    } else if (initColor.length !== undefined) {
      target[`${key}-r`] = initColor[0];
      target[`${key}-g`] = initColor[1];
      target[`${key}-b`] = initColor[2];
      target[`${key}-a`] = initColor[3];
      delete target[key];
    }
  }

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

// (Object[Any], Object[Any]) => Unit
const rejiggerLinks = (links, parent) => {
  Object.entries(links).forEach(
    ([who, link]) => {

      const l     = deepClone(link, {}, true);
      const xform = transform(l);

      rejiggerColor(l, "color");
      rejiggerColor(l, "label-color");

      xform("heading"  , (h) => Math.round(   h      ));
      xform("midpointx", (x) => Math.round(   x *  10));
      xform("midpointy", (y) => Math.round(   y *  10));
      xform("size"     , (s) => Math.  max(0, s * 100));
      xform("thickness", (s) => Math.  max(0, s * 100));

      xform("who", (w) => w + 1);

      parent[who] = l;

    }
  );
};

// (Object[Any], Object[Any], Boolean) => Unit
const rejiggerPatches = (patches, parent, isInitial) => {

  let truePatches = patches;

  /* eslint-disable dot-notation */
  if (isInitial) {

    const ps          = Object.values(patches);
    const template    = {};

    const basis          = ps[0];
    const baseColor      = basis["pcolor"];
    const baseLabel      = basis["plabel"];
    const baseLabelColor = basis["plabel-color"];

    if (ps.every((p) => p["pcolor"]       === baseColor) &&
        ps.every((p) => p["plabel"]       === baseLabel) &&
        ps.every((p) => p["plabel-color"] === baseLabelColor)) {

      template["pcolor"]       = baseColor;
      template["plabel"]       = baseLabel;
      template["plabel-color"] = baseLabelColor;

      const xcors = ps.map((p) => p.pxcor);
      const ycors = ps.map((p) => p.pycor);

      template["max-x"] = Math.max(...xcors);
      template["max-y"] = Math.max(...ycors);
      template["min-x"] = Math.min(...xcors);
      template["min-y"] = Math.min(...ycors);

      truePatches = { 0: template };

    }
    /* eslint-enable dot-notation */

  }

  Object.entries(truePatches).forEach(
    ([who, patch]) => {

      const p = deepClone(patch, {}, true);

      rejiggerColor(p, "pcolor");
      rejiggerColor(p, "plabel-color");

      parent[who] = p;

    }
  );

};

// (Object[Any], Object[Any]) => Unit
const rejiggerTurtles = (turtles, parent) => {
  Object.entries(turtles).forEach(
    ([who, turtle]) => {

      const t     = deepClone(turtle, {}, true);
      const xform = transform(t);

      rejiggerColor(t, "color");
      rejiggerColor(t, "label-color");

      xform("heading" , (h) => Math.round(   h      ));
      xform("pen-size", (s) => Math.  max(0, s * 100));
      xform("size"    , (s) => Math.  max(0, s * 100));
      xform("xcor"    , (x) => Math.round(   x *  10));
      xform("ycor"    , (y) => Math.round(   y *  10));

      xform("pen-mode", (m) => (m === "up") ? 0 : (m === "down") ? 1 : 2);

      // The clearest alternative to encoding dead agents as `0` is to encode them as
      // `MaxInt`.  The problem with that is that dead agents are pretty common in
      // NetLogo models, and `MaxInt` is several times the size in bytes.
      // --Jason B. (10/24/21)
      xform("who", (w) => w + 1);

      parent[who] = t;

    }
  );
};

// (Object[Any]) => Object[Any]
const rejiggerSprite = (sprite) => {

  const clone = deepClone(sprite);

  transform(clone)("elements", (es) => {
    return es.map(
      (e) => {

        const elem            = deepClone(e);
        const regex           = /rgba\((\d{1,3}), (\d{1,3}), (\d{1,3}), (\d{1,3}(?:\.\d)?)\)/;
        const [ , r, g, b, a] = elem.color.match(regex);

        elem.colorR = r;
        elem.colorG = g;
        elem.colorB = b;
        elem.colorA = Math.round(a * 10);

        return elem;

      }
    );
  });

  return clone;

};

// (Object[Any]) => Object[Any]
const rejiggerLinkShapes = (linkShapes) => {

  const out =
    Object.fromEntries(
      Object.entries(linkShapes).map(
        ([name, shape]) => {
          const s = deepClone(shape);
          transform(s)("curviness"          , (c) => Math.round(c * 1000));
          transform(s)("direction-indicator", rejiggerSprite);
          transform(s)("lines"              , (ls) => {
            return ls.map((l) => {
              const newL = deepClone(l);
              transform(newL)("x-offset", (xo) => Math.round(xo * 1000));
              return newL;
            });
          });
          return [name, s];
        }
      )
    );

  return out;

};

// (Object[Any]) => Object[Any]
const rejiggerTurtleShapes = (turtleShapes) => {

  const out =
    Object.fromEntries(
      Object.entries(turtleShapes).map(
        ([name, shape]) => {
          return [name, rejiggerSprite(shape)];
        }
      )
    );

  return out;

};

// (Object[Any], Object[Any]) => Unit
const rejiggerWorlds = (worlds, parent) => {
  Object.entries(worlds).forEach(
    ([who, world]) => {

      const w     = deepClone(world, {}, true, { editableColorIndex: true });
      const xform = transform(w);

      xform("patchsize", (s) => Math.round(s * 100));
      xform("ticks"    , (t) => Math.round(t * 100));

      xform("linkshapelist"  , rejiggerLinkShapes);
      xform("turtleshapelist", rejiggerTurtleShapes);

      parent[who] = w;

    }
  );
};

// (Object[Any], Object[Any], Boolean) => Unit
const rejiggerViewUpdates = (target, parent, isInitial) => {
  for (const k0 in target) {
    const v0 = target[k0];
    if (k0 === "links") {
      parent[k0] = {};
      rejiggerLinks(v0, parent[k0]);
    } else if (k0 === "patches") {
      parent[k0] = {};
      rejiggerPatches(v0, parent[k0], isInitial);
    } else if (k0 === "turtles") {
      parent[k0] = {};
      rejiggerTurtles(v0, parent[k0]);
    } else if (k0 === "world") {
      parent[k0] = {};
      rejiggerWorlds(v0, parent[k0]);
    } else if (k0 === "observer") {
      parent[k0] = deepClone(v0, {});
    } else if (k0 === "drawingEvents") {
      parent[k0] = [];
      rejiggerDrawingEvents(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any], Object[Any]) => Unit
const rejiggerChooserUpdates = (target, parent) => {
  for (const k0 in target) {
    const v0 = target[k0];
    parent[k0] = v0 + 1;
  }
};

// (Object[Any], Object[Any]) => Unit
const rejiggerInputNumUpdates = (target, parent) => {
  for (const k0 in target) {
    const v0 = target[k0];
    parent[k0] = Math.round(v0 * 1e4);
  }
};

// (Object[Any], Object[Any]) => Unit
const rejiggerPlotUpdates = (target, parent) => {

  for (const k0 in target) {

    const newPupdates = [];
    parent[k0]        = { value: newPupdates };

    for (const k1 in target[k0]) {
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
        rejiggerColor(outer.registerPen.pen, "color");
        newPupdates.push(outer);
      } else if (pupdate.type === "resize") {
        const outer = { resize: deepClone(pupdate, { type: 1 }) };
        transform(outer.resize)("xMin", (x) => Math.round(x * 10));
        transform(outer.resize)("xMax", (x) => Math.round(x * 10));
        transform(outer.resize)("yMin", (y) => Math.round(y * 10));
        transform(outer.resize)("yMax", (x) => Math.round(x * 10));
        newPupdates.push(outer);
      } else if (pupdate.type === "update-pen-color") {
        const outer = { updatePenColor: deepClone(pupdate, { type: 1 }) };
        rejiggerColor(outer.updatePenColor, "color");
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

// (Object[Any], Object[Any]) => Unit
const rejiggerSliderUpdates = (target, parent) => {
  for (const k0 in target) {
    const v0 = target[k0];
    parent[k0] = Math.round(v0 * 1e4);
  }
};

// (Object[Any], Object[Any]) => Unit
const rejiggerDrawingEvents = (target, parent) => {
  for (const k0 in target) {
    const devent = target[k0];
    // Rejigger *.drawingEvents > *[type="import-drawing-raincheck"], etc.
    if (devent.type === "clear-drawing") {
      const outer = { clearDrawing: {} };
      parent.push(outer);
    } else if (devent.type === "import-drawing-raincheck") {
      const outer = { importDrawingRaincheck: deepClone(devent) };
      parent.push(outer);
    } else if (devent.type === "import-drawing") {
      const outer = { importDrawing: deepClone(devent) };
      parent.push(outer);
    } else if (devent.type === "line") {

      const line  = deepClone(devent);
      const xform = transform(line);

      line.color = line.rgb;
      rejiggerColor(line, "color");
      delete line.rgb;

      xform("fromX", (x) => Math.round(x *  10));
      xform("fromY", (y) => Math.round(y *  10));
      xform(  "toX", (x) => Math.round(x *  10));
      xform(  "toY", (y) => Math.round(y *  10));
      xform( "size", (s) => Math.round(s * 100));

      xform("penMode", (m) => (m === "up") ? 0 : (m === "down") ? 1 : 2);

      const outer = { line };
      parent.push(outer);

    } else if (devent.type === "stamp-image") {

      if (devent.agentType === "turtle") {

        const turtleStamp = deepClone(devent.stamp, {}, false, {});
        const xform       = transform(turtleStamp);

        xform("heading"  , (h) => Math.round(   h      ));
        xform("size"     , (s) => Math.  max(0, s * 100));
        xform("x"        , (x) => Math.round(   x *  10));
        xform("y"        , (y) => Math.round(   y *  10));
        xform("stampMode", (m) => m !== "erase"         );

        rejiggerColor(turtleStamp, "color");

        const outer = { turtleStamp };
        parent.push(outer);

      } else if (devent.agentType === "link") {

        const linkStamp = deepClone(devent.stamp, {}, false, {});
        const xform     = transform(linkStamp);

        xform("heading"  , (h) => Math.round(   h      ));
        xform("midpointX", (x) => Math.round(   x *  10));
        xform("midpointY", (y) => Math.round(   y *  10));
        xform("size"     , (s) => Math.  max(0, s * 100));
        xform("thickness", (t) => Math.  max(0, t * 100));
        xform("x1"       , (x) => Math.round(   x *  10));
        xform("x2"       , (x) => Math.round(   x *  10));
        xform("y1"       , (y) => Math.round(   y *  10));
        xform("y2"       , (y) => Math.round(   y *  10));
        xform("stampMode", (m) => m !== "erase"         );

        rejiggerColor(linkStamp, "color");

        const outer = { linkStamp };
        parent.push(outer);

      } else {
        console.warn("Impossible type for devent.agentType!", devent);
      }
    } else {
      console.warn("Impossible type for devent!", devent);
    }
  }
};

// (Object[Any]) => Object[Any]
const rejiggerInitialModel = (obj) => {

  const out = {};
  for (const k0 in obj) {

    const v0 = obj[k0];

    if (k0 === "token") {
      rejiggerToken(v0, out);
    } else if (k0 === "role") {
      out[k0] = {};
      rejiggerRole(v0, out[k0]);
    } else if (k0 === "state") {
      out[k0] = {};
      rejiggerStateUpdateInner(v0, out[k0], true);
    } else {
      out[k0] = v0;
    }

  }

  return out;

};

const rejiggerRole = (target, parent) => {

  for (const k0 in target) {

    const v1 = target[k0];
    if (k0 === "widgets") {

      parent[k0] = [];

      for (const k1 in v1) {

        const widget = v1[k1];

        // Rejigger initial-model.role.widgets > [type="button"], etc.
        if (widget.type === "hnwButton") {
          const outer = { button: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);
        } else if (widget.type === "hnwChooser") {
          const outer = { chooser: deepClone(widget, { type: 1 }) };
          transform(outer.chooser)("choices", (xs) => JSON.stringify(xs));
          parent[k0].push(outer);
        } else if (widget.type === "hnwInputBox") {

          transform(widget)("boxedValue", (bv) => {

            bv.boxType = bv.type;
            delete bv.type;

            if (bv.boxType.startsWith("String")) {
              bv.strValue = bv.value;
            } else {
              bv.numValue = bv.value;
            }

            delete bv.value;

            return bv;

          });

          const outer = { inputBox: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);

        } else if (widget.type === "hnwMonitor") {
          const outer = { monitor: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);
        } else if (widget.type === "hnwOutput") {
          const outer = { output: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);
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

          parent[k0].push(outer);

        } else if (widget.type === "hnwSlider") {
          const outer = { slider: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);
        } else if (widget.type === "hnwSwitch") {
          const outer = { switch: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);
        } else if (widget.type === "hnwTextBox") {
          const outer = { textBox: deepClone(widget, { type: 1 }) };
          rejiggerColor(outer.textBox, "color");
          parent[k0].push(outer);
        } else if (widget.type === "hnwView") {
          const outer = { view: deepClone(widget, { type: 1 }) };
          parent[k0].push(outer);
        } else {
          console.log("This widget type shouldn't be possible...", widget);
        }
      }

    } else {
      parent[k0] = v1;
    }

  }

};

// (Object[Any], Object[Any], Boolean) => Unit
const rejiggerStateUpdateInner = (target, parent, isInitial) => {
  for (const k0 in target) {
    const v0 = target[k0];
    if (k0 === "viewUpdate") {
      parent[k0] = {};
      rejiggerViewUpdates(v0, parent[k0], isInitial);
    } else if (k0 === "chooserUpdates") {
      parent[k0] = {};
      rejiggerChooserUpdates(v0, parent[k0]);
    } else if (k0 === "inputNumUpdates") {
      parent[k0] = {};
      rejiggerInputNumUpdates(v0, parent[k0]);
    } else if (k0 === "plotUpdates") {
      parent[k0] = {};
      rejiggerPlotUpdates(v0, parent[k0]);
    } else if (k0 === "sliderUpdates") {
      parent[k0] = {};
      rejiggerSliderUpdates(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any]) => Object[Any]
const rejiggerStateUpdate = (obj) => {

  const out = {};

  for (const k0 in obj) {
    const v0 = obj[k0];
    if (k0 === "update") {
      out[k0] = {};
      rejiggerStateUpdateInner(v0, out[k0], false);
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

      recombobulateColor(l, "color"      );
      recombobulateColor(l, "label-color");

      xform("midpointx", (x) => x /  10);
      xform("midpointy", (y) => y /  10);
      xform("size"     , (s) => s / 100);
      xform("thickness", (s) => s / 100);

      // Must uppercase "WHO", due to bug in AgentModel --Jason B. (10/24/21)
      if (l.who !== undefined) {
        l.WHO = l.who - 1;
        delete l.who;
      }

      parent[who] = l;

    }
  );
};

// (Object[Any], Object[Any], Boolean) => Object[Any]
const recombobulatePatches = (patches, parent, isInitial) => {

  Object.entries(patches).forEach(
    ([who, patch]) => {

      const p = deepClone(patch);

      recombobulateColor(p, "pcolor"      );
      recombobulateColor(p, "plabel-color");

      parent[who] = p;

    }
  );

  if (isInitial && parent[0]["max-x"] !== undefined) {

    let counter = 0;

    const { "max-x": maxX, "max-y": maxY, "min-x": minX, "min-y": minY
          , pcolor, plabel, "plabel-color": plabelColor } = parent[0];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const p = { pxcor: x, pycor: y, pcolor, plabel
                  , "plabel-color": plabelColor };
        parent[counter++] = p;
      }
    }

  }

};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulateTurtles = (turtles, parent) => {
  Object.entries(turtles).forEach(
    ([who, turtle]) => {

      const t     = deepClone(turtle);
      const xform = transform(t);

      recombobulateColor(t, "color"      );
      recombobulateColor(t, "label-color");

      xform("pen-size", (s) => s / 100);
      xform("size"    , (s) => s / 100);
      xform("xcor"    , (x) => x /  10);
      xform("ycor"    , (y) => y /  10);

      xform("pen-mode", (m) => (m === 0) ? "up" : (m === 1) ? "down" : "erase");

      // Must uppercase "WHO", due to bug in AgentModel --Jason B. (10/24/21)
      if (t.who !== undefined) {
        t.WHO = t.who - 1;
        delete t.who;
      }

      parent[who] = t;

    }
  );
};

// (Object[Any]) => Object[Any]
const recombobulateSprite = (sprite) => {

  const clone = deepClone(sprite);

  if (clone.elements === undefined) {
    clone.elements = [];
  }

  transform(clone)("elements", (es) => {
    return es.map(
      (e) => {
        const blacklist    = { colorR: 1, colorG: 1, colorB: 1, colorA: 1 };
        const elem         = deepClone(e, blacklist);
        const [r, g, b, a] = [e.colorR, e.colorG, e.colorB, e.colorA / 10];
        elem.color         = `rgba(${r}, ${g}, ${b}, ${a})`;
        return elem;
      }
    );
  });

  return clone;

};

// (Object[Any]) => Object[Any]
const recombobulateLinkShapes = (linkShapes) => {

  const out =
    Object.fromEntries(
      Object.entries(linkShapes).map(
        ([name, shape]) => {
          const s = deepClone(shape);
          transform(s)("curviness"          , (c) => c / 1000);
          transform(s)("direction-indicator", recombobulateSprite);
          transform(s)("lines"              , (ls) => {
            return ls.map((l) => {
              const newL = deepClone(l);
              transform(newL)("x-offset", (xo) => xo / 1000);
              return newL;
            });
          });
          return [name, s];
        }
      )
    );

  return out;

};

// (Object[Any]) => Object[Any]
const recombobulateTurtleShapes = (turtleShapes) => {

  const out =
    Object.fromEntries(
      Object.entries(turtleShapes).map(
        ([name, shape]) => {
          return [name, recombobulateSprite(shape)];
        }
      )
    );

  return out;

};

// (Object[Any], Object[Any]) => Object[Any]
const recombobulateWorlds = (worlds, parent) => {
  Object.entries(worlds).forEach(
    ([who, world]) => {

      const w     = deepClone(world, {}, true, { editableColorIndex: true });
      const xform = transform(w);

      xform("patchsize", (s) => s / 100);
      xform("ticks"    , (t) => t / 100);

      xform("linkshapelist"  , recombobulateLinkShapes);
      xform("turtleshapelist", recombobulateTurtleShapes);

      parent[who] = w;

    }
  );
};


// (Object[Any], Object[Any], Boolean) => Object[Any]
const recombobulateViewUpdates = (target, parent, isInitial) => {
  for (const k0 in target) {
    const v0 = target[k0];
    if (k0 === "links") {
      parent[k0] = {};
      recombobulateLinks(v0, parent[k0]);
    } else if (k0 === "patches") {
      parent[k0] = {};
      recombobulatePatches(v0, parent[k0], isInitial);
    } else if (k0 === "turtles") {
      parent[k0] = {};
      recombobulateTurtles(v0, parent[k0]);
    } else if (k0 === "world") {
      parent[k0] = {};
      recombobulateWorlds(v0, parent[k0]);
    } else if (k0 === "drawingEvents") {
      parent[k0] = [];
      recombobulateDrawingEvents(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
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
const recombobulateHostAnswer = (obj) => {
  const out = deepClone(obj);
  out.answer.type = out.answer.answerType;
  delete out.answer.answerType;
  return out;
};

// (Object[Any], Number|Array[Number]) => Unit
const recombobulateColor = (target, key) => {
  if (target[key] !== undefined) {
    target[key] = target[key] / 10;
  } else if (target[`${key}-r`] !== undefined) {

    const r = target[`${key}-r`];
    const g = target[`${key}-g`];
    const b = target[`${key}-b`];
    const a = target[`${key}-a`];

    delete target[`${key}-r`];
    delete target[`${key}-g`];
    delete target[`${key}-b`];
    delete target[`${key}-a`];

    target[key] = (a !== undefined) ? [r, g, b, a] : [r, g, b];

  }
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

// (Object[Any], Object[Any]) => Unit
const recombobulateChooserUpdates = (target, parent) => {
  for (const k0 in target) {
    const v0 = target[k0];
    parent[k0] = v0 - 1;
  }
};

// (Object[Any], Object[Any]) => Unit
const recombobulateInputNumUpdates = (target, parent) => {
  for (const k0 in target) {
    const v0 = target[k0];
    parent[k0] = v0 / 1e4;
  }
};

// (Object[Any], Object[Any]) => Unit
const recombobulatePlotUpdates = (target, parent) => {

  for (const k0 in target) {

    const newPupdates = [];
    parent[k0]        = newPupdates;

    for (const k1 in target[k0].value) {

      const pupdate = target[k0].value[k1];

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
        recombobulateColor(out.pen, "color");
        newPupdates.push(out);
      } else if (pupdate.resize !== undefined) {
        const inner = pupdate.resize;
        const out   = { type: "resize", ...deepClone(inner) };
        transform(out)("xMin", (x) => x / 10);
        transform(out)("xMax", (x) => x / 10);
        transform(out)("yMin", (x) => x / 10);
        transform(out)("yMax", (x) => x / 10);
        newPupdates.push(out);
      } else if (pupdate.updatePenColor !== undefined) {
        const inner = pupdate.updatePenColor;
        const out   = { type: "update-pen-color", ...deepClone(inner) };
        recombobulateColor(out, "color");
        newPupdates.push(out);
      } else if (pupdate.updatePenMode !== undefined) {
        const inner = pupdate.updatePenMode;
        newPupdates.push({ type: "update-pen-mode", ...inner });
      } else {
        console.warn("Impossible key for pupdate!", pupdate);
      }

    }

  }

};

// (Object[Any], Object[Any]) => Unit
const recombobulateSliderUpdates = (target, parent) => {
  for (const k0 in target) {
    const v0 = target[k0];
    parent[k0] = v0 / 1e4;
  }
};

// (Object[Any], Object[Any]) => Unit
const recombobulateDrawingEvents = (target, parent) => {
  for (const k0 in target) {
    const devent = target[k0];
    // Recombobulate *.drawingEvents > *[type="import-drawing-raincheck"], etc.
    if (devent.clearDrawing !== undefined) {
      const replacement = { type: "clear-drawing" };
      parent.push(replacement);
    } else if (devent.importDrawingRaincheck !== undefined) {
      const replacement = { type: "import-drawing-raincheck", ...devent.importDrawingRaincheck };
      parent.push(replacement);
    } else if (devent.importDrawing !== undefined) {
      const outer = { type: "import-drawing", ...devent.importDrawing };
      parent.push(outer);
    } else if (devent.line !== undefined) {

      const outer = { type: "line", ...devent.line };
      const xform = transform(outer);

      recombobulateColor(outer, "color");
      outer.rgb = outer.color;
      delete outer.color;

      xform("fromX", (x) => x /  10);
      xform("fromY", (y) => y /  10);
      xform(  "toX", (x) => x /  10);
      xform(  "toY", (y) => y /  10);
      xform( "size", (s) => s / 100);

      xform("penMode", (m) => (m === "up") ? 0 : (m === "down") ? 1 : 2);

      parent.push(outer);

    } else if (devent.turtleStamp !== undefined) {

      const outer = { type:      "stamp-image"
                    , agentType: "turtle"
                    , stamp:     { ...devent.turtleStamp }
                    };

      const xform = transform(outer.stamp);

      xform("size"     , (s) => s / 100);
      xform("x"        , (x) => x /  10);
      xform("y"        , (y) => y /  10);
      xform("stampMode", (m) => m ? "normal" : "erase");

      recombobulateColor(outer.stamp, "color");

      parent.push(outer);

    } else if (devent.linkStamp !== undefined) {

      const outer = { type:      "stamp-image"
                    , agentType: "link"
                    , stamp:     { ...devent.linkStamp }
                    };

      const xform = transform(outer.stamp);

      xform("midpointX", (x) => x /  10);
      xform("midpointY", (x) => x /  10);
      xform("size"     , (s) => s / 100);
      xform("thickness", (s) => s / 100);
      xform("x1"       , (x) => x /  10);
      xform("x2"       , (x) => x /  10);
      xform("y1"       , (y) => y /  10);
      xform("y2"       , (y) => y /  10);
      xform("stampMode", (m) => m ? "normal" : "erase");

      recombobulateColor(outer.stamp, "color");

      parent.push(outer);

    } else {
      console.warn("Impossible key for devent!", devent);
    }
  }
};

// (Object[Any]) => Object[Any]
const recombobulateInitialModel = (obj) => {

  const out = {};

  recombobulateToken(obj, out);

  for (const k0 in obj) {

    const v0 = obj[k0];

    if (k0 === "role") {
      out[k0] = {};
      recombobulateRole(v0, out[k0]);
    } else if (k0 === "state") {
      out[k0] = {};
      recombobulateStateUpdateInner(v0, out[k0], true);
    } else {
      out[k0] = v0;
    }

  }

  return out;

};

const recombobulateRole = (target, parent) => {

  for (const k0 in target) {

    const v1 = target[k0];
    if (k0 === "widgets") {

      parent[k0] = [];

      // Recombobulate initial-model.role.widgets > *, etc.
      for (const k1 in v1) {

        const widget = v1[k1];

        if (widget.button !== undefined) {
          const inner = widget.button;
          parent[k0].push({ type: "hnwButton", ...inner });
        } else if (widget.chooser !== undefined) {

          const inner      = widget.chooser;
          const newChooser = { type: "hnwChooser", ...inner };
          transform(newChooser)("choices", (str) => JSON.parse(str));

          parent[k0].push(newChooser);

        } else if (widget.inputBox !== undefined) {

          const inner = widget.inputBox;

          transform(inner)("boxedValue", (bv) => {

            bv.type = bv.boxType;
            delete bv.boxType;

            bv.value = bv.strValue || bv.numValue;
            delete bv.numValue;
            delete bv.strValue;

            return bv;

          });

          parent[k0].push({ type: "hnwInputBox", ...inner });

        } else if (widget.monitor !== undefined) {
          const inner = widget.monitor;
          parent[k0].push({ type: "hnwMonitor", ...inner });
        } else if (widget.output !== undefined) {
          const inner = widget.output;
          parent[k0].push({ type: "hnwOutput", ...inner });
        } else if (widget.plot !== undefined) {

          const inner   = deepClone(widget.plot);
          const newPlot = { type: "hnwPlot", ...inner };

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

          parent[k0].push(newPlot);

        } else if (widget.slider !== undefined) {
          const inner = widget.slider;
          parent[k0].push({ type: "hnwSlider", ...inner });
        } else if (widget.switch !== undefined) {
          const inner = widget.switch;
          parent[k0].push({ type: "hnwSwitch", ...inner });
        } else if (widget.textBox !== undefined) {
          const inner       = widget.textBox;
          const replacement = { type: "hnwTextBox", ...deepClone(inner) };
          recombobulateColor(replacement, "color");
          parent[k0].push(replacement);
        } else if (widget.view !== undefined) {
          const inner  = deepClone(widget.view);
          inner.height = inner.bottom - inner.top;
          inner.width  = inner.right  - inner.left;
          parent[k0].push({ type: "hnwView", ...inner });
        } else {
          const s = "Well, that's impressive.  What widget type could this be?";
          console.warn(s, widget);
        }

      }

    } else {
      parent[k0] = v1;
    }

  }

};

// (Object[Any], Boolean) => Object[Any]
const recombobulateStateUpdateInner = (target, parent, isInitial) => {
  for (const k0 in target) {
    const v0 = target[k0];
    if (k0 === "viewUpdate") {
      parent[k0] = {};
      recombobulateViewUpdates(v0, parent[k0], isInitial);
    } else if (k0 === "chooserUpdates") {
      parent[k0] = {};
      recombobulateChooserUpdates(v0, parent[k0]);
    } else if (k0 === "inputNumUpdates") {
      parent[k0] = {};
      recombobulateInputNumUpdates(v0, parent[k0]);
    } else if (k0 === "plotUpdates") {
      parent[k0] = {};
      recombobulatePlotUpdates(v0, parent[k0]);
    } else if (k0 === "sliderUpdates") {
      parent[k0] = {};
      recombobulateSliderUpdates(v0, parent[k0]);
    } else if (k0 === "drawingEvents") {
      parent[k0] = {};
      recombobulateDrawingEvents(v0, parent[k0]);
    } else {
      parent[k0] = deepClone(v0);
    }
  }
};

// (Object[Any]) => Object[Any]
const recombobulateStateUpdate = (obj) => {

  const out = {};

  for (const k0 in obj) {
    const v0 = obj[k0];
    if (k0 === "update") {
      out[k0] = {};
      recombobulateStateUpdateInner(v0, out[k0], false);
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
    case "hnw-burst": {
      return rejiggerBurst(msg);
    }
    case "host-answer": {
      return rejiggerHostAnswer(msg);
    }
    case "initial-model": {
      return rejiggerInitialModel(msg);
    }
    case "state-update": {
      return rejiggerStateUpdate(msg);
    }
    case "role": {
      const out = {};
      rejiggerRole(msg, out);
      return out;
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
    case "hnw-burst": {
      return recombobulateBurst(msg);
    }
    case "host-answer": {
      return recombobulateHostAnswer(msg);
    }
    case "initial-model": {
      return recombobulateInitialModel(msg);
    }
    case "state-update": {
      return recombobulateStateUpdate(msg);
    }
    case "role": {
      const out = {};
      recombobulateRole(msg, out);
      return out;
    }
    default: {
      return deepClone(msg);
    }
  }
};

export { recombobulate, rejigger };

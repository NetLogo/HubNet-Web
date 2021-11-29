import { FromHostRoot, RootDescriptors } from "./protobuf/from-host-root.js";
import { StateUpdateDescriptors        } from "./protobuf/state-update.js";

import * as Furling from "./common-furling.js";

// (String) => ProtoBufType
const lookupType = (x) =>
  protobuf.Root.fromJSON(FromHostRoot).lookupType(x);

// Object[ProtoBufType]
const basicMap =
  { "bye-bye":                lookupType("ByeBye")
  , "chat":                   lookupType("Chat")
  , "chat-relay":             lookupType("ChatRelay")
  , "connection-established": lookupType("ConnEstablished")
  , "hnw-burst":              lookupType("HNWBurst")
  , "host-answer":            lookupType("HostAnswer")
  , "host-ice-candidate":     lookupType("ICECandy")
  , "incorrect-password":     lookupType("IncorrectPassword")
  , "initial-model":          lookupType("InitialModel")
  , "keep-alive":             lookupType("KeepAlive")
  , "login-successful":       lookupType("LoginSuccessful")
  , "no-username-given":      lookupType("NoUsernameGiven")
  , "ping":                   lookupType("Ping")
  , "state-update":           lookupType("StateUpdate")
  , "ticks-started":          lookupType("TicksStarted")
  , "username-already-taken": lookupType("UsernameTaken")
  };

const furlingMappings =
  { "unfurled-host-answer":          "HostAnswerUnfurled"
  , "unfurled-ice-candy":            "ICECandyUnfurled"
  , "unfurled-su-monitors":          "UpdateMonitors"
  , "unfurled-su-monitor1":          "UpdateMonitor1"
  , "unfurled-su-plot-values":       "UpdatePlotValues"
  , "unfurled-su-plot-add-point":    "UpdatePlotAddPoint"
  , "unfurled-su-plot-reset":        "UpdatePlotReset"
  , "unfurled-su-plot-reset-pen":    "UpdatePlotResetPen"
  , "unfurled-su-plot-register-pen": "UpdatePlotRegisterPen"
  , "unfurled-su-plot-resize":       "UpdatePlotResize"
  , "unfurled-su-plot-pen-color":    "UpdatePlotUpdatePenColor"
  , "unfurled-su-plot-pen-mode":     "UpdatePlotUpdatePenMode"
  , "unfurled-su-turtles":           "UpdateViewTurtles"
  , "unfurled-su-turtle1":           "UpdateViewTurtle1"
  , "unfurled-su-patches":           "UpdateViewPatches"
  , "unfurled-su-patch1":            "UpdateViewPatch1"
  , "unfurled-su-links":             "UpdateViewLinks"
  , "unfurled-su-link1":             "UpdateViewLink1"
  , "unfurled-su-observers":         "UpdateViewObservers"
  , "unfurled-su-observer1":         "UpdateViewObserver1"
  , "unfurled-su-worlds":            "UpdateViewWorlds"
  , "unfurled-su-world1":            "UpdateViewWorld1"
  , "unfurled-su-drawings":          "UpdateViewDrawings"
  , "unfurled-su-drawing-clear":     "UpdateViewDrawingClear"
  , "unfurled-su-drawing-import":    "UpdateViewDrawingImport"
  , "unfurled-su-drawing-raincheck": "UpdateViewDrawingRaincheck"
  };

// Object[ProtoBufType]
const furlingMap =
  Object.fromEntries(
    Object.entries(furlingMappings).map(([k, v]) => [k, lookupType(v)])
  );

// Object[ProtoBufType]
const typeMap = { ...basicMap, ...furlingMap };

// (Object[Any], Array[String]) => Object[Any]?
const runPath = (m, p) => {

  const whitelist = ["id", "type", "protocolVersion"];

  const inner = (msg, path) => {

    if (path.length === 0) {
      return msg;
    } else {

      const frag        = path.shift();
      const acceptables = whitelist.concat([frag]);
      const keys        = Object.keys(msg);
      const hasExcess   = keys.some((k) => !acceptables.includes(k));
      const result      = msg[frag];

      if (frag === "*" || frag === "!") {
        if (keys.length === 1) {
          return inner(msg[keys[0]], path);
        } else {
          console.warn("Can only unfurl singleton arrays", result, m, p, msg, path);
          return undefined;
        }
      } else if (!hasExcess && result !== undefined) {
        return inner(result, path);
      } else {
        console.warn("Path lookup failed", m, p, msg, path);
        return undefined;
      }

    }

  };

  return inner(m, p.slice(0));

};

// (Object[Any], Object[_]) => Object[Any]
const pluckFields = (target, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return target;
  } else {
    return Object.fromEntries(
      Object.entries(target).filter(([k, ]) => keys.includes(k))
    );
  }
};

// (String, FurlingDescriptor, Object[Any]) => Object[Any]
const unfurlMap = (newType, desc, msg) => {

  const pathResult = runPath(msg, desc.path);

  if (pathResult !== undefined) {
    const keys   = Object.keys(pathResult);
    const values = keys.map((k) => pluckFields(pathResult[k], desc.fields));
    return { type: newType
           , ...((msg.id !== undefined) ? { id: msg.id } : {})
           , keys
           , values
           };
  } else {
    return msg;
  }

};

// (String, FurlingDescriptor, Object[Any]) => Object[Any]
const unfurlMap1 = (newType, desc, msg) => {

  const pathResult = runPath(msg, desc.path);

  if (pathResult !== undefined) {
    const key   = Object.keys(pathResult)[0];
    const value = pluckFields(pathResult[key], desc.fields);
    return { type: newType
           , ...((msg.id !== undefined) ? { id: msg.id } : {})
           , key
           , value
           };
  } else {
    return msg;
  }

};

// (String, FurlingDescriptor, Object[Any]) => Object[Any]
const unfurlPlain = (newType, desc, msg) => {

  const pathResult = runPath(msg, desc.path);

  if (pathResult !== undefined) {
    const plucked = pluckFields(pathResult, desc.fields);
    return { type: newType
           , ...((msg.id !== undefined) ? { id: msg.id } : {})
           , ...plucked
           };
  } else {
    return msg;
  }

};

// (String, FurlingDescriptor, Object[Any]) => Object[Any]
const unfurlPlot1 = (newType, desc, msg) => {

  const pathResult = runPath(msg, desc.path);
  const plotName   = Object.keys(msg.update.plotUpdates)[0];

  if (pathResult !== undefined) {
    const plucked = pluckFields(pathResult, desc.fields);
    return { type: newType
           , ...((msg.id !== undefined) ? { id: msg.id } : {})
           , plotName
           , ...plucked
           };
  } else {
    return msg;
  }

};

// (String, Object[Any]) => Object[Any]
const unfurlByType = (newType, msg) => {

  const isSU       = newType.startsWith("unfurled-su-");
  const descBundle = isSU ? StateUpdateDescriptors : RootDescriptors;
  const baseDesc   = descBundle[furlingMappings[newType]];
  const desc       = isSU ? baseDesc.prefixPath(["update"]) : baseDesc;

  switch (desc.type) {
    case "map": {
      return unfurlMap(newType, desc, msg);
    }
    case "map1": {
      return unfurlMap1(newType, desc, msg);
    }
    case "plain": {
      return unfurlPlain(newType, desc, msg);
    }
    case "plot1": {
      return unfurlPlot1(newType, desc, msg);
    }
    default:
  }

  throw new Error(`Unknown desc type for furling: ${desc.type}`);

};

// (Object[Any]) => Object[Any]
const unfurlSoloMonitorUpdates = (msg) => {
  const keys = Object.keys(msg.update.monitorUpdates);
  if (keys.length === 1) {
    return unfurlByType("unfurled-su-monitor1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-monitors", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloPlotUpdates = (msg) => {
  const plots = msg.update.plotUpdates;
  if (Object.keys(plots).length === 1) {
    const pupdates = plots[Object.keys(plots)[0]].value;
    if (pupdates.length === 1) {
      const key = Object.keys(pupdates[0])[0];
      switch (key) {
        case "addPoint": {
          return unfurlByType("unfurled-su-plot-add-point", msg);
        }
        case "registerPen": {
          return unfurlByType("unfurled-su-plot-register-pen", msg);
        }
        case "reset": {
          return unfurlByType("unfurled-su-plot-pen", msg);
        }
        case "resetPen": {
          return unfurlByType("unfurled-su-plot-reset-pen", msg);
        }
        case "resize": {
          return unfurlByType("unfurled-su-plot-resize", msg);
        }
        case "updatePenColor": {
          return unfurlByType("unfurled-su-plot-pen-color", msg);
        }
        case "updatePenMode": {
          return unfurlByType("unfurled-su-plot-pen-mode", msg);
        }
        default:
      }
      return msg;
    } else if (pupdates.length > 1) {
      return unfurlByType("unfurled-su-plot-values", msg);
    } else {
      return msg;
    }
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloTurtles = (msg) => {
  const keys = Object.keys(msg.update.viewUpdate.turtles);
  if (keys.length === 1) {
    return unfurlByType("unfurled-su-turtle1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-turtles", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloPatches = (msg) => {
  const keys = Object.keys(msg.update.viewUpdate.patches);
  if (keys.length === 1) {
    return unfurlByType("unfurled-su-patch1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-patches", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloLinks = (msg) => {
  const keys = Object.keys(msg.update.viewUpdate.links);
  if (keys.length === 1) {
    return unfurlByType("unfurled-su-link1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-links", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloWorlds = (msg) => {
  const keys = Object.keys(msg.update.viewUpdate.world);
  if (keys.length === 1) {
    return unfurlByType("unfurled-su-world1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-worlds", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloObservers = (msg) => {
  const keys = Object.keys(msg.update.viewUpdate.observer);
  if (keys.length === 1) {
    return unfurlByType("unfurled-su-observer1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-observers", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloDrawingEvents = (msg) => {
  const devents = msg.update.viewUpdate.drawingEvents;
  if (devents.length === 1) {
    const key = Object.keys(devents[0])[0];
    switch (key) {
      case "clearDrawing": {
        return unfurlByType("unfurled-su-drawing-clear", msg);
      }
      case "importDrawing": {
        return unfurlByType("unfurled-su-drawing-import", msg);
      }
      case "importDrawingRaincheck": {
        return unfurlByType("unfurled-su-drawing-raincheck", msg);
      }
      default:
    }
    return msg;
  } else if (devents.length > 1) {
    return unfurlByType("unfurled-su-drawings", msg);
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloViewUpdate = (msg) => {
  const vupdate = msg.update.viewUpdate;
  const keys    = Object.keys(vupdate);
  if (keys.length === 1) {
    const key = keys[0];
    switch (key) {
      case "turtles": {
        return unfurlSoloTurtles(msg);
      }
      case "patches": {
        return unfurlSoloPatches(msg);
      }
      case "links": {
        return unfurlSoloLinks(msg);
      }
      case "world": {
        return unfurlSoloWorlds(msg);
      }
      case "observer": {
        return unfurlSoloObservers(msg);
      }
      case "drawingEvents": {
        return unfurlSoloDrawingEvents(msg);
      }
      default:
    }
    return msg;
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const unfurlSoloWidgetUpdates = (msg) => {

  const wupdates = msg.update.widgetUpdates;

  const keys = Object.keys(wupdates);

  if (keys.length === 1) {
    return unfurlByType("unfurled-su-widget1", msg);
  } else if (keys.length > 1) {
    return unfurlByType("unfurled-su-widgets", msg);
  } else {
    return msg;
  }

};

// (Object[Any]) => Object[Any]
const unfurlSU = (msg) => {
  const update = msg.update;
  const keys   = Object.keys(update);
  if (keys.length === 1) {
    const key = keys[0];
    switch (key) {
      case "monitorUpdates": {
        return unfurlSoloMonitorUpdates(msg);
      }
      case "plotUpdates": {
        return unfurlSoloPlotUpdates(msg);
      }
      case "viewUpdate": {
        return unfurlSoloViewUpdate(msg);
      }
      case "widgetUpdates": {
        return unfurlSoloWidgetUpdates(msg);
      }
      default:
    }
    return msg;
  } else {
    return msg;
  }
};

// (Object[Any]) => Object[Any]
const trueUnfurl = (msg) => {
  if (msg.type === "host-answer") {
    return unfurlByType("unfurled-host-answer", msg);
  } else if (msg.type === "host-ice-candidate") {
    return unfurlByType("unfurled-ice-candy", msg);
  } else if (msg.type === "state-update" && msg.update !== undefined) {
    return unfurlSU(msg);
  } else {
    return msg;
  }
};

// (Object[Any], Array[String], Object[Any]) => Object[Any]
const rebuildMap = (t, p, msg) => {

  const inner = (target, path) => {
    if (path.length === 0) {
      const out = {};
      for (let i = 0; i < msg.keys.length; i++) {
        out[msg.keys[i]] = msg.values[i];
      }
      return out;
    } else {
      const frag  = path.shift();
      const child = inner({}, path);
      if (frag === "*") {
        return [child];
      } else {
        target[frag] = child;
        return target;
      }
    }
  };

  return inner(t, p.slice(0));

};

// (FurlingDescriptor, Object[Any]) => Object[Any]
const furlMap = (desc, msg) => {
  const basis =
    { type: desc.rootType
    , ...((msg.id !== undefined) ? { id: msg.id } : {})
    };
  return rebuildMap(basis, desc.path, msg);
};

// (Object[Any], Array[String], Object[Any]) => Object[Any]
const rebuildMap1 = (t, p, msg) => {

  const inner = (target, path) => {
    if (path.length === 0) {
      return { [msg.key]: msg.value };
    } else {
      const frag  = path.shift();
      const child = inner({}, path);
      if (frag === "*") {
        return [child];
      } else {
        target[frag] = child;
        return target;
      }
    }
  };

  return inner(t, p.slice(0));

};

// (FurlingDescriptor, Object[Any]) => Object[Any]
const furlMap1 = (desc, msg) => {
  const basis =
    { type: desc.rootType
    , ...((msg.id !== undefined) ? { id: msg.id } : {})
    };
  return rebuildMap1(basis, desc.path, msg);
};

// (Object[Any], Array[String], Object[Any], String?) => Object[Any]
const rebuild = (t, p, msg, filler) => {

  const nugget =
    Object.fromEntries(
      Object.entries(msg).filter(([k, ]) => k !== "id" && k !== "type")
    );

  const inner = (target, path) => {
    if (path.length === 0) {
      return nugget;
    } else {
      const frag  = path.shift();
      const child = inner({}, path);
      if (frag === "*") {
        return [child];
      } else if (frag === "!" && filler !== undefined) {
        target[filler] = child;
        return target;
      } else {
        target[frag] = child;
        return target;
      }
    }
  };

  return inner(t, p.slice(0));

};

// (FurlingDescriptor, Object[Any]) => Object[Any]
const furlPlain = (desc, msg) => {
  const basis =
    { type: desc.rootType
    , ...((msg.id !== undefined) ? { id: msg.id } : {})
    };
  return rebuild(basis, desc.path, msg);
};

// (FurlingDescriptor, Object[Any]) => Object[Any]
const furlPlot1 = (desc, msg) => {
  const basis =
    { type: desc.rootType
    , ...((msg.id !== undefined) ? { id: msg.id } : {})
    };
  return rebuild(basis, desc.path, msg, msg.plotName);
};

// (Message) => Message
const furl = (msg) => {

  const isSU       = msg.type.startsWith("unfurled-su-");
  const descBundle = isSU ? StateUpdateDescriptors : RootDescriptors;
  const pbName     = furlingMappings[msg.type];

  if (pbName !== undefined) {
    const baseDesc = descBundle[pbName];
    const desc     = isSU ? baseDesc.prefixPath(["update"]) : baseDesc;
    if (desc !== undefined) {
      switch (desc.type) {
        case "map": {
          return furlMap(desc, msg);
        }
        case "map1": {
          return furlMap1(desc, msg);
        }
        case "plain": {
          return furlPlain(desc, msg);
        }
        case "plot1": {
          return furlPlot1(desc, msg);
        }
        default:
      }
      throw new Error(`Unknown desc type for furling: ${desc.type}`);
    } else {
      return msg;
    }
  } else {
    return msg;
  }

};

// (Number) => (String, ProtoBufType)
const lookupTypeCode = Furling.lookupTypeCode(typeMap);

// (Message) => (Message, ProtoBufType, Number)
const unfurl = Furling.unfurl(trueUnfurl, typeMap);

export { furl, lookupTypeCode, unfurl };

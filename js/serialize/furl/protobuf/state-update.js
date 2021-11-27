import { bareFieldsFrom, fromDescriptors, fromEntriesInner, fromEntries, fieldsFrom
       , FurlingDescriptor } from "./field-gen.js";

import deepFreeze from "/js/static/deep-freeze.js";

const turtleFields =
  { "breed":       "string"
  , "color":       "uint32"
  , "heading":     "uint32"
  , "hidden?":     "bool"
  , "label":       "string"
  , "label-color": "uint32"
  , "pen-mode":    "uint32"
  , "pen-size":    "uint32"
  , "shape":       "string"
  , "size":        "uint32"
  , "who":         "uint64"
  , "xcor":        "sint32"
  , "ycor":        "sint32"
  // Begin jiggery optimizations
  , "color-r":       "uint32"
  , "color-g":       "uint32"
  , "color-b":       "uint32"
  , "color-a":       "uint32"
  , "label-color-r": "uint32"
  , "label-color-g": "uint32"
  , "label-color-b": "uint32"
  , "label-color-a": "uint32"
  };

const patchFields =
  { "pcolor":       "uint32"
  , "plabel":       "string"
  , "plabel-color": "uint32"
  , "pxcor":        "sint32"
  , "pycor":        "sint32"
  // Begin jiggery optimizations
  , "pcolor-r":       "uint32"
  , "pcolor-g":       "uint32"
  , "pcolor-b":       "uint32"
  , "pcolor-a":       "uint32"
  , "plabel-color-r": "uint32"
  , "plabel-color-g": "uint32"
  , "plabel-color-b": "uint32"
  , "plabel-color-a": "uint32"
  };

const linkFields =
  { "breed":       "string"
  , "color":       "uint32"
  , "end1":        "uint32"
  , "end2":        "uint32"
  , "heading":     "uint32"
  , "hidden?":     "bool"
  , "directed?":   "bool"
  , "label":       "string"
  , "label-color": "uint32"
  , "midpointx":   "sint32"
  , "midpointy":   "sint32"
  , "shape":       "string"
  , "size":        "uint32"
  , "thickness":   "uint32"
  , "tie-mode":    "string"
  , "who":         "uint64"
  // Begin jiggery optimizations
  , "color-r":       "uint32"
  , "color-g":       "uint32"
  , "color-b":       "uint32"
  , "color-a":       "uint32"
  , "label-color-r": "uint32"
  , "label-color-g": "uint32"
  , "label-color-b": "uint32"
  , "label-color-a": "uint32"
  };

const worldFields =
  { linkbreeds:                ["string"     , true    ]
  , linkshapelist:             ["LinkShape"  , "string"]
  , maxpxcor:                   "uint32"
  , maxpycor:                   "uint32"
  , minpxcor:                   "sint32"
  , minpycor:                   "sint32"
  , patchesallblack:            "bool"
  , patcheswithlabels:          "uint64"
  , patchsize:                  "uint32"
  , ticks:                      "uint64"
  , turtlebreeds:              ["string"     , true    ]
  , turtleshapelist:           ["TurtleShape", "string"]
  , unbreededlinksaredirected:  "bool"
  , worldheight:                "uint64"
  , worldwidth:                 "uint64"
  , wrappingallowedinx:         "bool"
  , wrappingallowediny:         "bool"
  };

const obsFields =
  { followRadius:  "uint32"
  , perspective:   "uint32"
  , targetAgent:  ["uint32", true]
  };

const  turtlePath = ["viewUpdate",       "turtles"];
const   patchPath = ["viewUpdate",       "patches"];
const    linkPath = ["viewUpdate",         "links"];
const   worldPath = ["viewUpdate",         "world"];
const     obsPath = ["viewUpdate",      "observer"];
const drawingPath = ["viewUpdate", "drawingEvents"];

const  turtleEntry = ["turtles"      ,       "Turtle", "uint32"];
const   patchEntry = ["patches"      ,        "Patch", "uint32"];
const    linkEntry = ["link"         ,         "Link", "uint32"];
const   worldEntry = ["world"        ,        "World", "uint32"];
const     obsEntry = ["observer"     ,     "Observer", "uint32"];
const drawingEntry = ["drawingEvents", "DrawingEvent",    true ];

const viewEntries =
  [turtleEntry, patchEntry, linkEntry, worldEntry, obsEntry, drawingEntry];

const  cDrawingFields = {};
const  iDrawingFields = { hash: "sint64", imageBase64: "string" };
const raincheckFields = { hash: "sint64" };

const  cDrawingPath = ["viewUpdate", "drawingEvents", "*",  "clearDrawing"         ];
const  iDrawingPath = ["viewUpdate", "drawingEvents", "*", "importDrawing"         ];
const raincheckPath = ["viewUpdate", "drawingEvents", "*", "importDrawingRaincheck"];

const  cDrawingEntry = ["clearDrawing"          ,  "ClearDrawing"         ];
const  iDrawingEntry = ["importDrawing"         , "ImportDrawing"         ];
const raincheckEntry = ["importDrawingRaincheck", "ImportDrawingRaincheck"];

const drawingEntries = [cDrawingEntry, iDrawingEntry, raincheckEntry];

const drawingFields = bareFieldsFrom(drawingEntries);

const ViewUpdateStuff = {

  Turtle:   fieldsFrom(turtleFields)
, Patch:    fieldsFrom( patchFields)
, Link:     fieldsFrom(  linkFields)
, World:    fieldsFrom( worldFields)
, Observer: fieldsFrom(   obsFields)

, SVGType: {
    values: {
      line:      0
    , rectangle: 1
    , circle:    2
    , polygon:   3
    }
  }

, Element: {
    fields: {
      colorR: { type: "uint32" , id:  1 } // Pokery optimization
    , colorG: { type: "uint32" , id:  2 } // Pokery optimization
    , colorB: { type: "uint32" , id:  3 } // Pokery optimization
    , colorA: { type: "uint32" , id:  4 } // Pokery optimization
    , filled: { type: "bool"   , id:  5 }
    , marked: { type: "bool"   , id:  6 }
    , type:   { type: "SVGType", id:  7 }
    , x1:     { type: "sint32" , id:  8 } // line
    , x2:     { type: "sint32" , id:  9 } // line
    , y1:     { type: "sint32" , id: 10 } // line
    , y2:     { type: "sint32" , id: 11 } // line
    , xmax:   { type: "sint32" , id: 12 } // rectangle
    , xmin:   { type: "sint32" , id: 13 } // rectangle
    , ymax:   { type: "sint32" , id: 14 } // rectangle
    , ymin:   { type: "sint32" , id: 15 } // rectangle
    , x:      { type: "sint32" , id: 16 } // circle
    , y:      { type: "sint32" , id: 17 } // circle
    , diam:   { type: "sint32" , id: 18 } // circle
    , xcors:  { type: "sint32" , id: 19, rule: "repeated" } // polygon
    , ycors:  { type: "sint32" , id: 20, rule: "repeated" } // polygon
    }
  }

, DirInd: {
    fields: {
      editableColorIndex: { type: "uint32" , id: 1 }
    , elements:           { type: "Element", id: 2, rule: "repeated" }
    , name:               { type: "string" , id: 3 }
    , rotate:             { type: "bool"   , id: 4 }
    }
  }

, Line: {
    fields: {
      "dash-pattern": { type: "uint32", id: 1, rule: "repeated" }
    , "is-visible":   { type: "bool"  , id: 2 }
    , "x-offset":     { type: "uint32", id: 3 }
    }
  }

, LinkShape: {
    fields: {
      "curviness":           { type: "uint32", id: 1 }
    , "direction-indicator": { type: "DirInd", id: 2 }
    , "lines":               { type: "Line"  , id: 3, rule: "repeated" }
    , "name":                { type: "string", id: 4 }
    }
  }

, TurtleShape: {
    fields: {
      editableColorIndex: { type: "uint32" , id: 1 }
    , elements:           { type: "Element", id: 2, rule: "repeated" }
    , name:               { type: "string" , id: 3 }
    , rotate:             { type: "bool"   , id: 4 }
    }
  }

, DrawingEvent: {
    oneofs: {
      drawingEvent: {
        oneof: drawingEntries.map((e) => e[0])
      }
    }
  , fields: fromEntriesInner(drawingEntries)
  , nested: {
      ClearDrawing:           fieldsFrom( cDrawingFields)
    , ImportDrawing:          fieldsFrom( iDrawingFields)
    , ImportDrawingRaincheck: fieldsFrom(raincheckFields)
    }
  }

, ViewUpdate: fromEntries(viewEntries)

};

const addPointFields =
  { penName: "string"
  , x:       "sint32"
  , y:       "sint32"
  };

const resetPlotFields =
  { plot: "Plot"
  };

const resetPenFields =
  { penName: "string"
  };

const regPenFields =
  { pen: "Pen"
  };

const resizeFields =
  { xMin: "sint32"
  , xMax: "sint32"
  , yMin: "sint32"
  , yMax: "sint32"
  };

const penColorFields =
  { penName: "string"
  , color:   "uint32"
  // Begin jiggery optimizations
  , "color-r": "uint32"
  , "color-g": "uint32"
  , "color-b": "uint32"
  , "color-a": "uint32"
  };

const penModeFields =
  { penName: "string"
  , mode:    "string"
  };

const plotUpsFields = { value: ["PlotUpdate", true] };
const plotUpsPath   = ["plotUpdates"];

const plotFields =
  { name:            "string"
  , isLegendEnabled: "bool"
  , xLabel:          "string"
  , yLabel:          "string"
  };

const penFields =
  { name:  "string"
  , color: "uint32"
  // Begin jiggery optimizations
  , "color-r": "uint32"
  , "color-g": "uint32"
  , "color-b": "uint32"
  , "color-a": "uint32"
  };

const  addPointPath = ["plotUpdates", "!", "value", "*",       "addPoint"        ];
const resetPlotPath = ["plotUpdates", "!", "value", "*",          "reset", "plot"];
const  resetPenPath = ["plotUpdates", "!", "value", "*",       "resetPen"        ];
const    regPenPath = ["plotUpdates", "!", "value", "*",    "registerPen",  "pen"];
const    resizePath = ["plotUpdates", "!", "value", "*",         "resize"        ];
const  penColorPath = ["plotUpdates", "!", "value", "*", "updatePenColor"        ];
const   penModePath = ["plotUpdates", "!", "value", "*", "updatePenMode"         ];

const  addPointEntry = [      "addPoint", "PlotUpdateAddPoint"   ];
const resetPlotEntry = [         "reset", "PlotUpdateReset"      ];
const  resetPenEntry = [      "resetPen", "PlotUpdateResetPen"   ];
const    regPenEntry = [   "registerPen", "PlotUpdateRegisterPen"];
const    resizeEntry = [        "resize", "PlotUpdateResize"     ];
const  penColorEntry = ["updatePenColor", "PlotUpdatePenColor"   ];
const   penModeEntry = ["updatePenMode" , "PlotUpdatePenMode"    ];

const PlotUpdateStuff = {

  Pen:                   fieldsFrom(      penFields)
, Plot:                  fieldsFrom(     plotFields)
, PlotUpdateAddPoint:    fieldsFrom( addPointFields)
, PlotUpdateReset:       fieldsFrom(resetPlotFields)
, PlotUpdateResetPen:    fieldsFrom( resetPenFields)
, PlotUpdateRegisterPen: fieldsFrom(   regPenFields)
, PlotUpdateResize:      fieldsFrom(   resizeFields)
, PlotUpdatePenColor:    fieldsFrom( penColorFields)
, PlotUpdatePenMode:     fieldsFrom(  penModeFields)

, PlotUpdate: {
    oneofs: {
      plotUpdate: {
        oneof: [ "addPoint", "reset", "resetPen", "registerPen"
               , "resize", "updatePenColor", "updatePenMode"]
      }
    }
  , fields: {
      addPoint:       { type: "PlotUpdateAddPoint"   , id: 1 }
    , reset:          { type: "PlotUpdateReset"      , id: 2 }
    , resetPen:       { type: "PlotUpdateResetPen"   , id: 3 }
    , registerPen:    { type: "PlotUpdateRegisterPen", id: 4 }
    , resize:         { type: "PlotUpdateResize"     , id: 5 }
    , updatePenColor: { type: "PlotUpdatePenColor"   , id: 6 }
    , updatePenMode:  { type: "PlotUpdatePenMode"    , id: 7 }
    }
  }

, PlotUpdates: fieldsFrom(plotUpsFields)

};

const widgetFields =
  { varName: "string"
  , value:   "uint32"
  };

const WidgetUpdateStuff = {
  WidgetUpdate: fieldsFrom(widgetFields)
};

const monitorPath = ["monitorUpdates"];

const monitorEntry = ["monitorUpdates",        "string", "string"];
const plotUpsEntry = [   "plotUpdates",   "PlotUpdates", "string"];
const viewEntry    = [   "viewUpdate" ,   "ViewUpdate"           ];
const widgetEntry  = [ "widgetUpdates", "WidgetUpdate" ,     true];

const stateUpdateEntries = [monitorEntry, plotUpsEntry, viewEntry, widgetEntry];

const StateUpdate = fromEntries(stateUpdateEntries);

StateUpdate.nested =
  { ...PlotUpdateStuff
  , ...ViewUpdateStuff
  , ...WidgetUpdateStuff
  };

const rt = "state-update";

const newFD = (type, entry, fields, path) => {
  return FurlingDescriptor.new(type, rt, entry, fields, path);
};

const StateUpdateDescriptors =
  { UpdateMonitors:              newFD( "map" ,   monitorEntry,              [],   monitorPath)
  , UpdateMonitor1:              newFD( "map1",   monitorEntry,              [],   monitorPath)
  , UpdatePlotValues:            newFD( "map" ,   plotUpsEntry,   plotUpsFields,   plotUpsPath)
  , UpdatePlotAddPoint:          newFD("plot1",  addPointEntry,  addPointFields,  addPointPath)
  , UpdatePlotReset:             newFD("plot1", resetPlotEntry,      plotFields, resetPlotPath)
  , UpdatePlotResetPen:          newFD("plot1",  resetPenEntry,  resetPenFields,  resetPenPath)
  , UpdatePlotRegisterPen:       newFD("plot1",    regPenEntry,       penFields,    regPenPath)
  , UpdatePlotResize:            newFD("plot1",    resizeEntry,    resizeFields,    resizePath)
  , UpdatePlotUpdatePenColor:    newFD("plot1",  penColorEntry,  penColorFields,  penColorPath)
  , UpdatePlotUpdatePenMode:     newFD("plot1",   penModeEntry,   penModeFields,   penModePath)
  , UpdateViewTurtles:           newFD( "map" ,    turtleEntry,    turtleFields,    turtlePath)
  , UpdateViewTurtle1:           newFD( "map1",    turtleEntry,    turtleFields,    turtlePath)
  , UpdateViewPatches:           newFD( "map" ,     patchEntry,     patchFields,     patchPath)
  , UpdateViewPatch1:            newFD( "map1",     patchEntry,     patchFields,     patchPath)
  , UpdateViewLinks:             newFD( "map" ,      linkEntry,      linkFields,      linkPath)
  , UpdateViewLink1:             newFD( "map1",      linkEntry,      linkFields,      linkPath)
  , UpdateViewObservers:         newFD( "map" ,       obsEntry,       obsFields,       obsPath)
  , UpdateViewObserver1:         newFD( "map1",       obsEntry,       obsFields,       obsPath)
  , UpdateViewWorlds:            newFD( "map" ,     worldEntry,     worldFields,     worldPath)
  , UpdateViewWorld1:            newFD( "map1",     worldEntry,     worldFields,     worldPath)
  , UpdateViewDrawings:          newFD("plain",   drawingEntry,   drawingFields,   drawingPath)
  , UpdateViewDrawingClear:      newFD("plain",  cDrawingEntry,  cDrawingFields,  cDrawingPath)
  , UpdateViewDrawingImport:     newFD("plain",  iDrawingEntry,  iDrawingFields,  iDrawingPath)
  , UpdateViewDrawingRaincheck:  newFD("plain", raincheckEntry, raincheckFields, raincheckPath)
  };

const StateUpdateUnfurls = fromDescriptors(StateUpdateDescriptors);

deepFreeze(StateUpdate);
deepFreeze(StateUpdateDescriptors);
deepFreeze(StateUpdateUnfurls);

export { StateUpdate, StateUpdateDescriptors, StateUpdateUnfurls };

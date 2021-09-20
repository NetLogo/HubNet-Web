const ViewUpdateStuff = {

  Turtle: {
    fields: {
      "breed":       { type: "string", id:  1 }
    , "color":       { type: "double", id:  2 }
    , "heading":     { type: "double", id:  3 }
    , "hidden?":     { type: "bool"  , id:  4 }
    , "label":       { type: "string", id:  5 }
    , "label-color": { type: "double", id:  6 }
    , "pen-mode":    { type: "string", id:  7 }
    , "pen-size":    { type: "double", id:  8 }
    , "shape":       { type: "string", id:  9 }
    , "size":        { type: "double", id: 10 }
    , "who":         { type: "uint32", id: 11 }
    , "xcor":        { type: "double", id: 12 }
    , "ycor":        { type: "double", id: 13 }
    }
  }

, Patch: {
    fields: {
      "pcolor":       { type: "double", id: 1 }
    , "plabel":       { type: "string", id: 2 }
    , "plabel-color": { type: "double", id: 3 }
    , "pxcor":        { type: "double", id: 4 }
    , "pycor":        { type: "double", id: 5 }
    }
  }

, Link: {
    fields: {
      "breed":       { type: "string", id:  1 }
    , "color":       { type: "double", id:  2 }
    , "end1":        { type: "uint32", id:  3 }
    , "end2":        { type: "uint32", id:  4 }
    , "heading":     { type: "double", id:  5 }
    , "hidden?":     { type: "bool"  , id:  6 }
    , "directed?":   { type: "bool"  , id:  7 }
    , "label":       { type: "string", id:  8 }
    , "label-color": { type: "double", id:  9 }
    , "midpointx":   { type: "double", id: 10 }
    , "midpointy":   { type: "double", id: 11 }
    , "shape":       { type: "string", id: 12 }
    , "size":        { type: "double", id: 13 }
    , "thickness":   { type: "double", id: 14 }
    , "tie-mode":    { type: "string", id: 15 }
    }
  }

, World: {

    fields: {
      linkbreeds:                { type: "string"     , id:  1, rule: "repeated" }
    , linkshapelist:             { type: "LinkShape"  , id:  2, keyType: "string" }
    , patchesallblack:           { type: "bool"       , id:  3 }
    , patcheswithlabels:         { type: "uint64"     , id:  4 }
    , ticks:                     { type: "double"     , id:  5 }
    , turtlebreeds:              { type: "string"     , id:  6, rule: "repeated" }
    , turtleshapelist:           { type: "TurtleShape", id:  7, keyType: "string" }
    , unbreededlinksaredirected: { type: "bool"       , id:  8 }
    , worldheight:               { type: "double"     , id:  9 }
    , worldwidth:                { type: "double"     , id: 10 }
    }

  , nested: {

      SVGType: {
        values: {
          line:      0
        , rectangle: 1
        , circle:    2
        , polygon:   3
        }
      }

    , Element: {
        fields: {
          color:  { type: "string" , id:  1 }
        , filled: { type: "bool"   , id:  2 }
        , marked: { type: "bool"   , id:  3 }
        , type:   { type: "SVGType", id:  4 }
        , x1:     { type: "sint32" , id:  5 } // line
        , x2:     { type: "sint32" , id:  6 } // line
        , y1:     { type: "sint32" , id:  7 } // line
        , y2:     { type: "sint32" , id:  8 } // line
        , xmax:   { type: "sint32" , id:  9 } // rectangle
        , xmin:   { type: "sint32" , id: 10 } // rectangle
        , ymax:   { type: "sint32" , id: 11 } // rectangle
        , ymin:   { type: "sint32" , id: 12 } // rectangle
        , x:      { type: "sint32" , id: 13 } // circle
        , y:      { type: "sint32" , id: 14 } // circle
        , diam:   { type: "sint32" , id: 15 } // circle
        , xcors:  { type: "sint32" , id: 16, rule: "repeated" } // polygon
        , ycors:  { type: "sint32" , id: 17, rule: "repeated" } // polygon
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
        , "x-offset":     { type: "double", id: 3 }
        }
      }

    , LinkShape: {
        fields: {
          "curviness":           { type: "double", id: 1 }
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

    }

  }

, Observer: {
    fields: {
      "perspective": { type: "uint32", id: 1 }
    , "targetAgent": { type: "uint32", id: 2 }
    }
  }

, ViewUpdate: {
    fields: {
      turtles:  { type: "Turtle"  , id: 1, keyType: "uint32" }
    , patches:  { type: "Patch"   , id: 2, keyType: "uint32" }
    , links:    { type: "Link"    , id: 3, keyType: "uint32" }
    , world:    { type: "World"   , id: 4, keyType: "uint32" }
    , observer: { type: "Observer", id: 5, keyType: "uint32" }
    }
  }

};

const PlotUpdateStuff = {

  Pen: {
    fields: {
      name:            { type: "string", id: 1 }
    , color:           { type: "double", id: 2 }
    }
  }

, Plot: {
    fields: {
      name:            { type: "string", id: 1 }
    , isLegendEnabled: { type: "bool"  , id: 2 }
    , xLabel:          { type: "string", id: 3 }
    , yLabel:          { type: "string", id: 4 }
    }
  }

, PlotUpdateAddPoint: {
    fields: {
      penName: { type: "string", id: 1 }
    , x:       { type: "double", id: 2 }
    , y:       { type: "double", id: 3 }
    }
  }

, PlotUpdateReset: {
    fields: {
      plot: { type: "Plot", id: 1 }
    }
  }

, PlotUpdateResetPen: {
    fields: {
      penName: { type: "string", id: 1 }
    }
  }

, PlotUpdateRegisterPen: {
    fields: {
      pen: { type: "Pen", id: 1 }
    }
  }

, PlotUpdatePenColor: {
    fields: {
      penName: { type: "string", id: 1 }
    , color:   { type: "double", id: 2 }
    }
  }

, PlotUpdatePenMode: {
    fields: {
      penName: { type: "string", id: 1 }
    , penMode: { type: "string", id: 2 }
    }
  }

, PlotUpdate: {
    oneofs: {
      plotUpdate: {
        oneof: ["addPoint", "reset", "resetPen", "registerPen", "updatePenColor", "updatePenMode"]
      }
    }
  , fields: {
      addPoint:       { type: "PlotUpdateAddPoint"   , id: 1 }
    , reset:          { type: "PlotUpdateReset"      , id: 2 }
    , resetPen:       { type: "PlotUpdateResetPen"   , id: 3 }
    , registerPen:    { type: "PlotUpdateRegisterPen", id: 4 }
    , updatePenColor: { type: "PlotUpdatePenColor"   , id: 5 }
    , updatePenMode:  { type: "PlotUpdatePenMode"    , id: 6 }
    }
  }

, PlotUpdates: {
    fields: {
      value: { type: "PlotUpdate", id: 1, rule: "repeated" }
    }
  }

};

const WidgetUpdateStuff = {
  WidgetUpdate: {
    fields: {
      "varName": { type: "string", id: 1 }
    , "value":   { type: "uint32", id: 2 }
    }
  }
};

window.StateUpdatePB = {
  fields: {
    viewUpdate:     { type: "ViewUpdate"  , id: 1 }
  , plotUpdates:    { type: "PlotUpdates" , id: 2, keyType: "string" }
  , monitorUpdates: { type: "string"      , id: 3, keyType: "string" }
  , ticks:          { type: "uint64"      , id: 4 }
  , widgetUpdates:  { type: "WidgetUpdate", id: 5, rule: "repeated" }
  }
, nested: Object.assign({}, PlotUpdateStuff, ViewUpdateStuff, WidgetUpdateStuff)
};

const ViewUpdateStuff2 = {

  Turtle: {
    fields: {
      "BREED":       { type: "string", id:  1 }
    , "COLOR":       { type: "double", id:  2 }
    , "HEADING":     { type: "double", id:  3 }
    , "WHO":         { type: "uint32", id:  4 }
    , "LABEL-COLOR": { type: "double", id:  5 }
    , "HIDDEN?":     { type: "bool"  , id:  6 }
    , "LABEL":       { type: "string", id:  7 }
    , "PEN-SIZE":    { type: "double", id:  8 }
    , "PEN-MODE":    { type: "string", id:  9 }
    , "SHAPE":       { type: "string", id: 10 }
    , "SIZE":        { type: "double", id: 11 }
    , "XCOR":        { type: "double", id: 12 }
    , "YCOR":        { type: "double", id: 13 }
    }
  }


, Patch: {
    fields: {
      "WHO":          { type: "uint32", id: 1 }
    , "PCOLOR":       { type: "double", id: 2 }
    , "PLABEL":       { type: "string", id: 3 }
    , "PLABEL-COLOR": { type: "double", id: 4 }
    , "PXCOR":        { type: "double", id: 5 }
    , "PYCOR":        { type: "double", id: 6 }
    }
  }

, Link: {
    fields: {
      "BREED":       { type: "string", id:  1 }
    , "COLOR":       { type: "double", id:  2 }
    , "END1":        { type: "uint32", id:  3 }
    , "END2":        { type: "uint32", id:  4 }
    , "HEADING":     { type: "double", id:  5 }
    , "HIDDEN?":     { type: "bool"  , id:  6 }
    , "ID":          { type: "uint32", id:  7 }
    , "DIRECTED?":   { type: "bool"  , id:  8 }
    , "LABEL":       { type: "string", id:  9 }
    , "LABEL-COLOR": { type: "double", id: 10 }
    , "MIDPOINTX":   { type: "double", id: 11 }
    , "MIDPOINTY":   { type: "double", id: 12 }
    , "SHAPE":       { type: "string", id: 13 }
    , "SIZE":        { type: "double", id: 14 }
    , "THICKNESS":   { type: "double", id: 15 }
    , "TIE-MODE":    { type: "string", id: 16 }
    }
  }

, World: {
    fields: {
      "worldHeight":               { type: "double", id:  1 }
    , "WHO":                       { type: "uint32", id:  2 }
    , "patchesAllBlack":           { type: "bool"  , id:  3 }
    , "patchesWithLabels":         { type: "bool"  , id:  4 }
    , "MAXPXCOR":                  { type: "uint64", id:  5 }
    , "MAXPYCOR":                  { type: "uint64", id:  6 }
    , "MINPXCOR":                  { type: "sint64", id:  7 }
    , "MINPYCOR":                  { type: "sint64", id:  8 }
    , "patchSize":                 { type: "double", id:  9 }
    , "ticks":                     { type: "double", id: 10 }
    , "unbreededLinksAreDirected": { type: "bool"  , id: 11 }
    , "worldWidth":                { type: "double", id: 12 }
    , "wrappingAllowedInX":        { type: "bool"  , id: 13 }
    , "wrappingAllowedInY":        { type: "bool"  , id: 14 }
    }
  }

, Observer: {
    fields: {
      "WHO":         { type: "uint32", id: 1 }
    , "perspective": { type: "uint32", id: 2 }
    , "targetAgent": { type: "uint32", id: 3 }
    }
  }

, ViewUpdate: {
    fields: {
      turtles:  { type: "Turtle"  , id: 1, keyType: "uint32" }
    , patches:  { type: "Patch"   , id: 2, keyType: "uint32" }
    , links:    { type: "Link"    , id: 3, keyType: "uint32" }
    , world:    { type: "World"   , id: 4, keyType: "uint32" }
    , observer: { type: "Observer", id: 5, keyType: "uint32" }
    }
  }

};

const PlotUpdateStuff2 = {

  Pen: {
    fields: {
      name:            { type: "string", id: 1 }
    , color:           { type: "double", id: 2 }
    }
  }

, Plot: {
    fields: {
      name:            { type: "string", id: 1 }
    , isLegendEnabled: { type: "bool"  , id: 2 }
    , xLabel:          { type: "string", id: 3 }
    , yLabel:          { type: "string", id: 4 }
    }
  }

, PlotUpdateAddPoint: {
    fields: {
      penName: { type: "string", id: 1 }
    , x:       { type: "double", id: 2 }
    , y:       { type: "double", id: 3 }
    }
  }

, PlotUpdateReset: {
    fields: {
      plot: { type: "Plot", id: 1 }
    }
  }

, PlotUpdateResetPen: {
    fields: {
      penName: { type: "string", id: 1 }
    }
  }

, PlotUpdateRegisterPen: {
    fields: {
      pen: { type: "Pen", id: 1 }
    }
  }

, PlotUpdatePenColor: {
    fields: {
      penName: { type: "string", id: 1 }
    , color:   { type: "double", id: 2 }
    }
  }

, PlotUpdatePenMode: {
    fields: {
      penName: { type: "string", id: 1 }
    , penMode: { type: "string", id: 2 }
    }
  }

, PlotUpdate: {
    oneofs: {
      plotUpdate: {
        oneof: ["addPoint", "reset", "resetPen", "registerPen", "updatePenColor", "updatePenMode"]
      }
    }
  , fields: {
      addPoint:       { type: "PlotUpdateAddPoint"   , id: 1 }
    , reset:          { type: "PlotUpdateReset"      , id: 2 }
    , resetPen:       { type: "PlotUpdateResetPen"   , id: 3 }
    , registerPen:    { type: "PlotUpdateRegisterPen", id: 4 }
    , updatePenColor: { type: "PlotUpdatePenColor"   , id: 5 }
    , updatePenMode:  { type: "PlotUpdatePenMode"    , id: 6 }
    }
  }

, PlotUpdates: {
    fields: {
      value: { type: "PlotUpdate", id: 1, rule: "repeated" }
    }
  }

};

const WidgetUpdateStuff2 = {
  WidgetUpdate: {
    fields: {
      "varName": { type: "string", id: 1 }
    , "value":   { type: "uint32", id: 2 }
    }
  }
};

window.StateUpdatePB2 = {
  fields: {
    viewUpdate:     { type: "ViewUpdate"  , id: 1 }
  , plotUpdates:    { type: "PlotUpdates" , id: 2, keyType: "string" }
  , monitorUpdates: { type: "string"      , id: 3, keyType: "string" }
  , ticks:          { type: "uint64"      , id: 4 }
  , widgetUpdates:  { type: "WidgetUpdate", id: 5, rule: "repeated" }
  }
, nested: Object.assign({}, PlotUpdateStuff2, ViewUpdateStuff2, WidgetUpdateStuff2)
};

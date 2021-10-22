const ViewUpdateStuff = {

  Turtle: {
    fields: {
      "breed":       { type: "string", id:  1 }
    , "color":       { type: "uint32", id:  2 }
    , "heading":     { type: "uint32", id:  3 }
    , "hidden?":     { type: "bool"  , id:  4 }
    , "label":       { type: "string", id:  5 }
    , "label-color": { type: "uint32", id:  6 }
    , "pen-mode":    { type: "uint32", id:  7 }
    , "pen-size":    { type: "uint32", id:  8 }
    , "shape":       { type: "string", id:  9 }
    , "size":        { type: "uint32", id: 10 }
    , "who":         { type: "uint64", id: 11 }
    , "xcor":        { type: "sint32", id: 12 }
    , "ycor":        { type: "sint32", id: 13 }
    }
  }

, Patch: {
    fields: {
      "pcolor":       { type: "uint32", id: 1 }
    , "plabel":       { type: "string", id: 2 }
    , "plabel-color": { type: "uint32", id: 3 }
    , "pxcor":        { type: "sint32", id: 4 }
    , "pycor":        { type: "sint32", id: 5 }
    }
  }

, Link: {
    fields: {
      "breed":       { type: "string", id:  1 }
    , "color":       { type: "uint32", id:  2 }
    , "end1":        { type: "uint32", id:  3 }
    , "end2":        { type: "uint32", id:  4 }
    , "heading":     { type: "uint32", id:  5 }
    , "hidden?":     { type: "bool"  , id:  6 }
    , "directed?":   { type: "bool"  , id:  7 }
    , "label":       { type: "string", id:  8 }
    , "label-color": { type: "uint32", id:  9 }
    , "midpointx":   { type: "sint32", id: 10 }
    , "midpointy":   { type: "sint32", id: 11 }
    , "shape":       { type: "string", id: 12 }
    , "size":        { type: "uint32", id: 13 }
    , "thickness":   { type: "uint32", id: 14 }
    , "tie-mode":    { type: "string", id: 15 }
    }
  }

, World: {

    fields: {
      linkbreeds:                { type: "string"     , id:  1, rule: "repeated" }
    , linkshapelist:             { type: "LinkShape"  , id:  2, keyType: "string" }
    , maxpxcor:                  { type: "uint32"     , id:  3 }
    , maxpycor:                  { type: "uint32"     , id:  4 }
    , minpxcor:                  { type: "sint32"     , id:  5 }
    , minpycor:                  { type: "sint32"     , id:  6 }
    , patchesallblack:           { type: "bool"       , id:  7 }
    , patcheswithlabels:         { type: "uint64"     , id:  8 }
    , patchsize:                 { type: "uint32"     , id:  9 }
    , ticks:                     { type: "uint64"     , id: 10 }
    , turtlebreeds:              { type: "string"     , id: 11, rule: "repeated" }
    , turtleshapelist:           { type: "TurtleShape", id: 12, keyType: "string" }
    , unbreededlinksaredirected: { type: "bool"       , id: 13 }
    , worldheight:               { type: "uint64"     , id: 14 }
    , worldwidth:                { type: "uint64"     , id: 15 }
    , wrappingallowedinx:        { type: "bool"       , id: 16 }
    , wrappingallowediny:        { type: "bool"       , id: 17 }
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
    , "targetagent": { type: "uint32", id: 2 }
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
      name:  { type: "string", id: 1 }
    , color: { type: "uint32", id: 2 }
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
    , x:       { type: "sint32", id: 2 }
    , y:       { type: "sint32", id: 3 }
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
    , color:   { type: "uint32", id: 2 }
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

const StateUpdatePB = {
  fields: {
    viewUpdate:     { type: "ViewUpdate"  , id: 1 }
  , plotUpdates:    { type: "PlotUpdates" , id: 2, keyType: "string" }
  , monitorUpdates: { type: "string"      , id: 3, keyType: "string" }
  , widgetUpdates:  { type: "WidgetUpdate", id: 4, rule: "repeated" }
  }
, nested: Object.assign({}, PlotUpdateStuff, ViewUpdateStuff, WidgetUpdateStuff)
};

export { StateUpdatePB }

const RolePB = {
  fields: {
    name:            { type: "string", id:  1 }
  , limit:           { type: "sint32", id:  2 }
  , canJoinMidRun:   { type: "bool"  , id:  3 }
  , isSpectator:     { type: "bool"  , id:  4 }
  , perspectiveVar:  { type: "string", id:  5 }
  , onConnect:       { type: "string", id:  6 }
  , onDisconnect:    { type: "string", id:  7 }
  , onCursorClick:   { type: "string", id:  8 }
  , onCursorRelease: { type: "string", id:  9 }
  , onCursorMove:    { type: "string", id: 10 }
  , widgets:         { type: "Widget", id: 11, rule: "repeated" }
  }
, nested: {
    Widget: {
      oneofs: {
        widgetOneOf: {
          oneof: [ "button", "chooser", "inputBox", "monitor", "output", "plot", "slider"
                 , "switch", "textBox", "view"]
        }
      }
    , fields: {
        button:   { type: "Button"  , id:  1 }
      , chooser:  { type: "Chooser" , id:  2 }
      , inputBox: { type: "InputBox", id:  3 }
      , monitor:  { type: "Monitor" , id:  4 }
      , output:   { type: "Output"  , id:  5 }
      , plot:     { type: "Plot"    , id:  6 }
      , slider:   { type: "Slider"  , id:  7 }
      , "switch": { type: "Switch"  , id:  8 }
      , textBox:  { type: "TextBox" , id:  9 }
      , view:     { type: "View"    , id: 10 }
      }
    , nested: {

        AgentKind: {
          values: {
            "observer": 0
          , "turtle":   1
          , "patch":    2
          , "link":     3
          }
        }

      , BoxedValueType: {
          values: {
            "String":            0
          , "Number":            1
          , "Color":             2
          , "String (reporter)": 3
          , "String (commands)": 4
          }
        }

      , Direction: {
          values: {
            "horizontal": 0
          , "vertical":   1
          }
        }

      , ReporterStyle: {
          values: {
            "global-procedure": 0
          , "global-var":       1
          , "turtle-procedure": 2
          , "turtle-var":       3
          }
        }

      , BoxedValue: {
          fields: {
            multiline: { type: "bool"          , id: 1 }
          , type:      { type: "BoxedValueType", id: 2 }
          , numValue:  { type: "double"        , id: 3 }
          , strValue:  { type: "string"        , id: 4 }
          }
        }

      , Pen: {
          fields: {
            display:    { type: "string", id: 1 }
          , mode:       { type: "uint32", id: 2 }
          , interval:   { type: "double", id: 3 }
          , inLegend:   { type: "bool"  , id: 4 }
          , color:      { type: "sint32", id: 5 }
          , setupCode:  { type: "string", id: 6 }
          , updateCode: { type: "string", id: 7 }
          }
      }

      , Button: {
          fields: {
            left:                   { type: "uint32"   , id:  1 }
          , right:                  { type: "uint32"   , id:  2 }
          , top:                    { type: "uint32"   , id:  3 }
          , bottom:                 { type: "uint32"   , id:  4 }
          , display:                { type: "string"   , id:  5 }
          , source:                 { type: "string"   , id:  6 }
          , hnwProcName:            { type: "string"   , id:  7 }
          , forever:                { type: "bool"     , id:  8 }
          , disableUntilTicksStart: { type: "bool"     , id:  9 }
          , buttonKind:             { type: "AgentKind", id: 10 }
          , actionKey:              { type: "string"   , id: 11 }
          }
        }

      , Chooser: {
          fields: {
            left:          { type: "uint32"   , id:  1 }
          , right:         { type: "uint32"   , id:  2 }
          , top:           { type: "uint32"   , id:  3 }
          , bottom:        { type: "uint32"   , id:  4 }
          , display:       { type: "string"   , id:  5 }
          , variable:      { type: "string"   , id:  6 }
          , currentChoice: { type: "uint32"   , id:  7 }
          , choices:       { type: "bytes"    , id:  8 }
          }
        }

      , InputBox: {
          fields: {
            left:       { type: "uint32"    , id:  1 }
          , right:      { type: "uint32"    , id:  2 }
          , top:        { type: "uint32"    , id:  3 }
          , bottom:     { type: "uint32"    , id:  4 }
          , variable:   { type: "string"    , id:  5 }
          , boxedValue: { type: "BoxedValue", id:  6 }
          }
        }

      , Monitor: {
          fields: {
            left:          { type: "uint32"       , id:  1 }
          , right:         { type: "uint32"       , id:  2 }
          , top:           { type: "uint32"       , id:  3 }
          , bottom:        { type: "uint32"       , id:  4 }
          , display:       { type: "string"       , id:  5 }
          , source:        { type: "string"       , id:  6 }
          , reporterStyle: { type: "ReporterStyle", id:  7 }
          , precision:     { type: "uint32"       , id:  8 }
          , fontSize:      { type: "uint32"       , id:  9 }
          }
        }

      , Output: {
          fields: {
            left:          { type: "uint32", id:  1 }
          , right:         { type: "uint32", id:  2 }
          , top:           { type: "uint32", id:  3 }
          , bottom:        { type: "uint32", id:  4 }
          , fontSize:      { type: "uint32", id:  5 }
          }
      }

      , Plot: {
          fields: {
            left:          { type: "uint32" , id:  1 }
          , right:         { type: "uint32" , id:  2 }
          , top:           { type: "uint32" , id:  3 }
          , bottom:        { type: "uint32" , id:  4 }
          , display:       { type: "string" , id:  5 }
          , xAxis:         { type: "string" , id:  6 }
          , yAxis:         { type: "string" , id:  7 }
          , xmin:          { type: "double" , id:  8 }
          , xmax:          { type: "double" , id:  9 }
          , ymin:          { type: "double" , id: 10 }
          , ymax:          { type: "double" , id: 11 }
          , autoPlotOn:    { type: "bool"   , id: 12 }
          , legendOn:      { type: "bool"   , id: 13 }
          , setupCode:     { type: "string" , id: 14 }
          , updateCode:    { type: "string" , id: 15 }
          , pens:          { type: "Pen"    , id: 16, keyType: "string" }
          }
        }

      , Slider: {
          fields: {
            left:      { type: "uint32"   , id:  1 }
          , right:     { type: "uint32"   , id:  2 }
          , top:       { type: "uint32"   , id:  3 }
          , bottom:    { type: "uint32"   , id:  4 }
          , display:   { type: "string"   , id:  5 }
          , variable:  { type: "string"   , id:  6 }
          , min:       { type: "double"   , id:  7 }
          , max:       { type: "double"   , id:  8 }
          , "default": { type: "double"   , id:  9 }
          , units:     { type: "string"   , id: 10 }
          , direction: { type: "Direction", id: 11 }
          , step:      { type: "double"   , id: 12 }
          }
        }

      , Switch: {
          fields: {
            left:     { type: "uint32", id:  1 }
          , right:    { type: "uint32", id:  2 }
          , top:      { type: "uint32", id:  3 }
          , bottom:   { type: "uint32", id:  4 }
          , display:  { type: "string", id:  5 }
          , variable: { type: "string", id:  6 }
          , on:       { type: "bool"  , id:  7 }
          }
        }

      , TextBox: {
          fields: {
            left:        { type: "uint32", id:  1 }
          , right:       { type: "uint32", id:  2 }
          , top:         { type: "uint32", id:  3 }
          , bottom:      { type: "uint32", id:  4 }
          , display:     { type: "string", id:  5 }
          , color:       { type: "double", id:  6 }
          , fontSize:    { type: "uint32", id:  7 }
          , transparent: { type: "bool"  , id:  8 }
          }
      }

      , View: {
          fields: {
            left:   { type: "uint32", id:  1 }
          , right:  { type: "uint32", id:  2 }
          , top:    { type: "uint32", id:  3 }
          , bottom: { type: "uint32", id:  4 }
          , height: { type: "uint32", id:  5 }
          , width:  { type: "uint32", id:  6 }
          }
        }

      }
    }
  }
};

export { RolePB }

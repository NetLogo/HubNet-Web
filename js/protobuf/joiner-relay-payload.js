const JoinerRelayPayloadPB = {

  oneofs: {
    dataOneOf: {
      oneof: ["hnwCashRaincheckPayload", "data"]
    }
  }

, fields: {
    token:                   { type: "string"               , id:  1 }
  , protocolVersion:         { type: "string"               , id:  2 }
  , type:                    { type: "string"               , id:  3 }
  , hnwCashRaincheckPayload: { type: "CashRaincheckPayload" , id:  4 }
  , data:                    { type: "PLData"               , id:  5 }
  }

, nested: {

    ButtonPayload: {
      fields: {
        "message": { type: "string", id: 1 }
      }
    }

  , CashRaincheckPayload: {
      fields: {
        "id": { type: "string", id: 1 }
      }
    }

  , ChooserIndexPayload: {
      fields: {
        "varName": { type: "string", id: 1 }
      , "value":   { type: "uint32", id: 2 }
      }
    }

  , InputBoxNumberPayload: {
      fields: {
        "varName": { type: "string", id: 1 }
      , "value":   { type: "double", id: 2 }
      }
    }

  , InputBoxStringPayload: {
      fields: {
        "varName": { type: "string", id: 1 }
      , "value":   { type: "string", id: 2 }
      }
    }

  , MouseUpPayload: {
      fields: {
        "xcor": { type: "double", id: 1 }
      , "ycor": { type: "double", id: 2 }
      }
    }

  , MouseDownPayload: {
      fields: {
        "xcor": { type: "double", id: 1 }
      , "ycor": { type: "double", id: 2 }
      }
    }

  , MouseMovePayload: {
      fields: {
        "xcor": { type: "double", id: 1 }
      , "ycor": { type: "double", id: 2 }
      }
    }

  , SliderPayload: {
      fields: {
        "varName": { type: "string", id: 1 }
      , "value":   { type: "double", id: 2 }
      }
    }

  , SwitchPayload: {
      fields: {
        "varName": { type: "string", id: 1 }
      , "value":   { type: "bool"  , id: 2 }
      }
    }

  , PLData: {
      oneofs: {
        widgetOneOf: {
          oneof: [ "hnwButtonPayload", "hnwChooserPayload", "hnwInputNumberPayload"
                 , "hnwInputStringPayload", "hnwMouseUpPayload", "hnwMouseDownPayload"
                 , "hnwMouseMovePayload", "hnwSliderPayload", "hnwSwitchPayload"
                 ]
        }
      }
    , fields: {
        hnwButtonPayload:        { type: "ButtonPayload"        , id: 1 }
      , hnwChooserPayload:       { type: "ChooserIndexPayload"  , id: 2 }
      , hnwInputNumberPayload:   { type: "InputBoxNumberPayload", id: 3 }
      , hnwInputStringPayload:   { type: "InputBoxStringPayload", id: 4 }
      , hnwSliderPayload:        { type: "SliderPayload"        , id: 5 }
      , hnwMouseUpPayload:       { type: "MouseUpPayload"       , id: 6 }
      , hnwMouseDownPayload:     { type: "MouseDownPayload"     , id: 7 }
      , hnwMouseMovePayload:     { type: "MouseMovePayload"     , id: 8 }
      , hnwSwitchPayload:        { type: "SwitchPayload"        , id: 9 }
      }
    }

  }
};

const hnwPBTransformers =
  [ ["t::relay", "payload", "event", "hnw-cash-raincheck", "hnwCashRaincheckPayload"]
  , ["t::relay", "payload", "data", "button" , "hnwButtonPayload"]
  , ["t::relay", "payload", "data", "chooser", "hnwChooserPayload"]
  , ["t::relay", "payload", "data", "input78", "hnwInputNumberPayload"] // BAD input
  , ["t::relay", "payload", "data", "input"  , "hnwInputStringPayload"]
  , ["t::relay", "payload", "data", "mouse-up"  , "hnwMouseUpPayload"] // BAD mouse
  , ["t::relay", "payload", "data", "mouse-down", "hnwMouseUpPayload"] // BAD mouse
  , ["t::relay", "payload", "data", "mouse-move", "hnwMouseUpPayload"] // BAD mouse
  , ["t::relay", "payload", "data", "slider" , "hnwSliderPayload"]
  , ["t::relay", "payload", "data", "switch" , "hnwSwitchPayload"]
  ];

export { hnwPBTransformers, JoinerRelayPayloadPB }
import { fieldsFrom } from "./field-gen.js";

import deepFreeze from "/js/static/deep-freeze.js";

// (Object[Any]) => Object[Any]
const unfurledFrom = (obj) => {
  return fieldsFrom({ id:          "uint32"
                    , tokenChunk1: "uint32"
                    , tokenChunk2: "uint32"
                    , tokenChunk3: "uint32"
                    , tokenChunk4: "uint32"
                    , ...obj
                    });
};

const buttonFields      = { message: "string" };
const chooserFields     = { varName: "string", value: "uint32" };
const inputNumberFields = { varName: "string", value: "sint64" };
const inputStringFields = { varName: "string", value: "string" };
const mouseUpFields     = { xcor:    "sint32", ycor:  "sint32" };
const mouseDownFields   = { xcor:    "sint32", ycor:  "sint32" };
const mouseMoveFields   = { xcor:    "sint32", ycor:  "sint32" };
const sliderFields      = { varName: "string", value: "sint64" };
const switchFields      = { varName: "string", value: "bool"   };

const JoinerRelayPayloadPB = {

  oneofs: {
    dataOneOf: {
      oneof: ["hnwCashRaincheckPayload", "data"]
    }
  }

, fields: {
    type:                    { type: "string"              , id:  1 }
  , hnwCashRaincheckPayload: { type: "CashRaincheckPayload", id:  2 }
  , data:                    { type: "PLData"              , id:  3 }
  // Begin jiggery optimizations
  , tokenChunk1: { type: "uint32", id: 4 }
  , tokenChunk2: { type: "uint32", id: 5 }
  , tokenChunk3: { type: "uint32", id: 6 }
  , tokenChunk4: { type: "uint32", id: 7 }
  }

, nested: {

    CashRaincheckPayload: {
      fields: {
        "hash": { type: "sint64", id: 1 }
      }
    }

  , ButtonPayload:         fieldsFrom(     buttonFields)
  , ChooserIndexPayload:   fieldsFrom(    chooserFields)
  , InputBoxNumberPayload: fieldsFrom(inputNumberFields)
  , InputBoxStringPayload: fieldsFrom(inputStringFields)
  , MouseUpPayload:        fieldsFrom(    mouseUpFields)
  , MouseDownPayload:      fieldsFrom(  mouseDownFields)
  , MouseMovePayload:      fieldsFrom(  mouseMoveFields)
  , SliderPayload:         fieldsFrom(     sliderFields)
  , SwitchPayload:         fieldsFrom(     switchFields)

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
      , hnwMouseUpPayload:       { type: "MouseUpPayload"       , id: 5 }
      , hnwMouseDownPayload:     { type: "MouseDownPayload"     , id: 6 }
      , hnwMouseMovePayload:     { type: "MouseMovePayload"     , id: 7 }
      , hnwSliderPayload:        { type: "SliderPayload"        , id: 8 }
      , hnwSwitchPayload:        { type: "SwitchPayload"        , id: 9 }
      }
    }

  }
};

const RelayUnfurls = {
  UnfurlRelayButton:      unfurledFrom(     buttonFields)
, UnfurlRelayChooser:     unfurledFrom(    chooserFields)
, UnfurlRelayInputNumber: unfurledFrom(inputNumberFields)
, UnfurlRelayInputString: unfurledFrom(inputStringFields)
, UnfurlRelayMouseUp:     unfurledFrom(    mouseUpFields)
, UnfurlRelayMouseDown:   unfurledFrom(  mouseDownFields)
, UnfurlRelayMouseMove:   unfurledFrom(  mouseMoveFields)
, UnfurlRelaySlider:      unfurledFrom(     sliderFields)
, UnfurlRelaySwitch:      unfurledFrom(     switchFields)
};

deepFreeze(JoinerRelayPayloadPB);
deepFreeze(RelayUnfurls);

export { JoinerRelayPayloadPB, RelayUnfurls };

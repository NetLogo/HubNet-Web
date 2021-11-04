import { FromJoinerRoot } from "./from-joiner-root.js";

import * as Furling from "./common-furling.js";

// (String) => ProtoBufType
const lookupType = (x) =>
  protobuf.Root.fromJSON(FromJoinerRoot).lookupType(x);

const basicMap =
  { "bye-bye":                lookupType("ByeBye"         )
  , "connection-established": lookupType("ConnEstablished")
  , "joiner-ice-candidate":   lookupType("ICECandy"       )
  , "joiner-offer":           lookupType("JoinerOffer"    )
  , "login":                  lookupType("Login"          )
  , "pong":                   lookupType("Pong"           )
  , "relay":                  lookupType("Relay"          )
  };

const furlingMap =
  { "unfurled-relay-button":       lookupType("UnfurlRelayButton"     )
  , "unfurled-relay-chooser":      lookupType("UnfurlRelayChooser"    )
  , "unfurled-relay-input-number": lookupType("UnfurlRelayInputNumber")
  , "unfurled-relay-input-string": lookupType("UnfurlRelayInputString")
  , "unfurled-relay-mouse-up":     lookupType("UnfurlRelayMouseUp"    )
  , "unfurled-relay-mouse-down":   lookupType("UnfurlRelayMouseDown"  )
  , "unfurled-relay-mouse-move":   lookupType("UnfurlRelayMouseMove"  )
  , "unfurled-relay-slider":       lookupType("UnfurlRelaySlider"     )
  , "unfurled-relay-switch":       lookupType("UnfurlRelaySwitch"     )
  };

const typeMap = { ...basicMap, ...furlingMap };

const fieldNameToType =
  { hnwButtonPayload:      "unfurled-relay-button"
  , hnwChooserPayload:     "unfurled-relay-chooser"
  , hnwInputNumberPayload: "unfurled-relay-input-number"
  , hnwInputStringPayload: "unfurled-relay-input-string"
  , hnwMouseUpPayload:     "unfurled-relay-mouse-up"
  , hnwMouseDownPayload:   "unfurled-relay-mouse-down"
  , hnwMouseMovePayload:   "unfurled-relay-mouse-move"
  , hnwSliderPayload:      "unfurled-relay-slider"
  , hnwSwitchPayload:      "unfurled-relay-switch"
  };

// (Object[Any]) => (Array[String]) => Object[Any]
const unfurlWidget = (msg) => (fieldNames) => {

  const matcher =
    fieldNames.find((name) => msg.payload.data[name] !== undefined);

  if (matcher !== undefined) {
    return { type:        fieldNameToType[matcher]
           , id:          msg.id
           , tokenChunk1: msg.payload.tokenChunk1
           , tokenChunk2: msg.payload.tokenChunk2
           , tokenChunk3: msg.payload.tokenChunk3
           , tokenChunk4: msg.payload.tokenChunk4
           , ...msg.payload.data[matcher]
           };
  } else {
    console.error("Impossible-to-unfurl widget message!", msg);
    return {};
  }

};

// (Object[Any]) => Object[Any]
const trueUnfurl = (msg) => {
  if (msg.type === "relay") {
    if (msg.payload.type === "hnw-widget-message") {
      return unfurlWidget(msg)(
        [ "hnwButtonPayload"
        , "hnwChooserPayload"
        , "hnwInputNumberPayload"
        , "hnwInputStringPayload"
        , "hnwMouseUpPayload"
        , "hnwMouseDownPayload"
        , "hnwMouseMovePayload"
        , "hnwSliderPayload"
        , "hnwSwitchPayload"
        ]
      );
    } else {
      return msg;
    }
  } else {
    return msg;
  }
};

// (Message) => Message
const furl = (message) => {

  const pluck = (target, keys) => {
    const obj = {};
    keys.forEach((key) => obj[key] = target[key]);
    return obj;
  };

  const reconstitute = (msg, widgetType, dataKeys) => {
    const data = pluck(msg, dataKeys);
    return { id:      msg.id
           , payload: { type: "hnw-widget-message"
                      , data:        { [widgetType]: data }
                      , tokenChunk1: msg.tokenChunk1
                      , tokenChunk2: msg.tokenChunk2
                      , tokenChunk3: msg.tokenChunk3
                      , tokenChunk4: msg.tokenChunk4
                      }
           , type:    "relay"
           };
  };

  const correlator =
    { "unfurled-relay-button":       ["hnwButtonPayload"     , ["message"]         ]
    , "unfurled-relay-chooser":      ["hnwChooserPayload"    , ["varName", "value"]]
    , "unfurled-relay-input-number": ["hnwInputNumberPayload", ["varName", "value"]]
    , "unfurled-relay-input-string": ["hnwInputStringPayload", ["varName", "value"]]
    , "unfurled-relay-mouse-up":     ["hnwMouseUpPayload"    , ["xcor"   , "ycor" ]]
    , "unfurled-relay-mouse-down":   ["hnwMouseDownPayload"  , ["xcor"   , "ycor" ]]
    , "unfurled-relay-mouse-move":   ["hnwMouseMovePayload"  , ["xcor"   , "ycor" ]]
    , "unfurled-relay-slider":       ["hnwSliderPayload"     , ["varName", "value"]]
    , "unfurled-relay-switch":       ["hnwSwitchPayload"     , ["varName", "value"]]
    };

  const correlation   = correlator[message.type];
  const doesCorrelate = correlation !== undefined;

  return doesCorrelate ? reconstitute(message, ...correlation) : message;

};

// (Number) => (String, ProtoBufType)
const lookupTypeCode = Furling.lookupTypeCode(typeMap);

// (Message) => (Message, ProtoBufType, Number)
const unfurl = Furling.unfurl(trueUnfurl, typeMap);

export { furl, lookupTypeCode, unfurl };

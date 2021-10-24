import { FromJoinerRoot } from "./from-joiner-root.js"

import * as Furling from "./common-furling.js"

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
const furl = (msg) => {

  const pluck = (msg, keys) => {
    const obj = {}
    keys.forEach((key) => obj[key] = msg[key]);
    return obj;
  };

  const reconstitute = (msg, widgetType, dataKeys) => {
    const data = pluck(msg, dataKeys);
    data.type = widgetType;
    return { id:      msg.id
           , payload: { type: "hnw-widget-message"
                      , data
                      , tokenChunk1: msg.tokenChunk1
                      , tokenChunk2: msg.tokenChunk2
                      , tokenChunk3: msg.tokenChunk3
                      , tokenChunk4: msg.tokenChunk4
                      }
           , type:    "relay"
           };
  };

  const correlator =
    { "unfurled-relay-button":       ["button"    , ["message"]         ]
    , "unfurled-relay-chooser":      ["chooser"   , ["varName", "value"]]
    , "unfurled-relay-input-number": ["input78"   , ["varName", "value"]]
    , "unfurled-relay-input-string": ["input"     , ["varName", "value"]]
    , "unfurled-relay-mouse-up":     ["mouse-up"  , ["xcor"   , "ycor" ]]
    , "unfurled-relay-mouse-down":   ["mouse-down", ["xcor"   , "ycor" ]]
    , "unfurled-relay-mouse-move":   ["mouse-move", ["xcor"   , "ycor" ]]
    , "unfurled-relay-slider":       ["slider"    , ["varName", "value"]]
    , "unfurled-relay-switch":       ["switch"    , ["varName", "value"]]
    };

  const correlation = correlator[msg.type];

  return (correlation !== undefined) ? reconstitute(msg, ...correlation) : msg;

};

// (Number) => (String, ProtoBufType)
const lookupTypeCode = Furling.lookupTypeCode(typeMap);

// (Message) => (Message, ProtoBufType, Number)
const unfurl = Furling.unfurl(trueUnfurl, typeMap);

export { furl, lookupTypeCode, unfurl }

import { FromJoinerRoot } from "./protobuf/from-joiner-root.js";

import * as Furling from "./common-furling.js";

// (String) => ProtoBufType
const lookupType = (x) =>
  protobuf.Root.fromJSON(FromJoinerRoot).lookupType(x);

// Object[ProtoBufType]
const basicMap =
  { "bye-bye":                lookupType("ByeBye"         )
  , "connection-established": lookupType("ConnEstablished")
  , "joiner-ice-candidate":   lookupType("ICECandy"       )
  , "joiner-offer":           lookupType("JoinerOffer"    )
  , "login":                  lookupType("Login"          )
  , "pong":                   lookupType("Pong"           )
  , "relay":                  lookupType("Relay"          )
  };

// type FurlingConfig = { pbName :: String, unfurledPBName :: String, unfurledType :: String, pluckables :: Array[String] }
//
// Array[FurlingConfig]
const furlingConfigs =
  [ { pbName: "hnwButtonPayload"     , unfurledPBName: "UnfurlRelayButton"     , unfurledType: "unfurled-relay-button"      , pluckables: ["message"]          }
  , { pbName: "hnwChooserPayload"    , unfurledPBName: "UnfurlRelayChooser"    , unfurledType: "unfurled-relay-chooser"     , pluckables: ["varName", "value"] }
  , { pbName: "hnwInputNumberPayload", unfurledPBName: "UnfurlRelayInputNumber", unfurledType: "unfurled-relay-input-number", pluckables: ["varName", "value"] }
  , { pbName: "hnwInputStringPayload", unfurledPBName: "UnfurlRelayInputString", unfurledType: "unfurled-relay-input-string", pluckables: ["varName", "value"] }
  , { pbName: "hnwMouseUpPayload"    , unfurledPBName: "UnfurlRelayMouseUp"    , unfurledType: "unfurled-relay-mouse-up"    , pluckables: ["xcor"   , "ycor" ] }
  , { pbName: "hnwMouseDownPayload"  , unfurledPBName: "UnfurlRelayMouseDown"  , unfurledType: "unfurled-relay-mouse-down"  , pluckables: ["xcor"   , "ycor" ] }
  , { pbName: "hnwMouseMovePayload"  , unfurledPBName: "UnfurlRelayMouseMove"  , unfurledType: "unfurled-relay-mouse-move"  , pluckables: ["xcor"   , "ycor" ] }
  , { pbName: "hnwSliderPayload"     , unfurledPBName: "UnfurlRelaySlider"     , unfurledType: "unfurled-relay-slider"      , pluckables: ["varName", "value"] }
  , { pbName: "hnwSwitchPayload"     , unfurledPBName: "UnfurlRelaySwitch"     , unfurledType: "unfurled-relay-switch"      , pluckables: ["varName", "value"] }
  ];

// (Array[FurlingConfig]) => Object[ProtoBufType]
const genFurlingMap = (configs) => {
  return Object.fromEntries(
    configs.map((c) => [c.unfurledType, lookupType(c.unfurledPBName)])
  );
};

// Object[ProtoBufType]
const typeMap = { ...basicMap, ...genFurlingMap(furlingConfigs) };

// Object[String]
const fieldNameToType = (fieldName) => {
  return furlingConfigs.find((c) => c.pbName === fieldName).unfurledType;
};

// (Object[Any]) => (Array[String]) => Object[Any]
const unfurlWidget = (msg) => (fieldNames) => {

  const matcher =
    fieldNames.find((name) => msg.payload.data[name] !== undefined);

  if (matcher !== undefined) {
    return { type:        fieldNameToType(matcher)
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
      return unfurlWidget(msg)(furlingConfigs.map((c) => c.pbName));
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
    keys.forEach((key) => { obj[key] = target[key]; });
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

  const config        = furlingConfigs.find((c) => c.unfurledType === message.type);
  const doesCorrelate = config !== undefined;

  return doesCorrelate ? reconstitute(message, config.pbName, config.pluckables) :
                         message;

};

// (Number) => (String, ProtoBufType)
const lookupTypeCode = Furling.lookupTypeCode(typeMap);

// (Message) => (Message, ProtoBufType, Number)
const unfurl = Furling.unfurl(trueUnfurl, typeMap);

export { furl, lookupTypeCode, unfurl };

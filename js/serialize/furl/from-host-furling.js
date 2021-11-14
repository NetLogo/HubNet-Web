import { FromHostRoot } from "./protobuf/from-host-root.js";

import * as Furling from "./common-furling.js";

// (String) => ProtoBufType
const lookupType = (x) =>
  protobuf.Root.fromJSON(FromHostRoot).lookupType(x);

// Object[ProtoBufType]
const basicMap =
  { "bye-bye":                lookupType("ByeBye")
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
  , "relay":                  lookupType("Relay")
  , "state-update":           lookupType("StateUpdate")
  , "username-already-taken": lookupType("UsernameTaken")
  };

// Object[ProtoBufType]
const furlingMap =
  {
  };

// Object[ProtoBufType]
const typeMap = { ...basicMap, ...furlingMap };

// (Object[Any]) => Object[Any]
const trueUnfurl = (msg) => {
  return msg;
};

// (Message) => Message
const furl = (msg) => {
  return msg;
};

// (Number) => (String, ProtoBufType)
const lookupTypeCode = Furling.lookupTypeCode(typeMap);

// (Message) => (Message, ProtoBufType, Number)
const unfurl = Furling.unfurl(trueUnfurl, typeMap);

export { furl, lookupTypeCode, unfurl };

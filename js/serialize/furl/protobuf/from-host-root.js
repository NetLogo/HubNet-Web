import deepFreeze from "/js/static/deep-freeze.js";

import { fromDescriptors, fieldsFrom, FurlingDescriptor } from "./field-gen.js";
import { RolePB                                         } from "./role.js";

import * as SUPB from "./state-update.js";

const answerFields =
  { answerType: "string"
  , sdp:        "string"
  };

const candyFields =
  { candidate:     "string"
  , sdpMid:        "string"
  , sdpMLineIndex: "uint32"
  };

const answerPath = ["answer"];
const candyPath  = ["candidate"];

const RootDescriptors =
  { HostAnswerUnfurled: FurlingDescriptor.new("plain", "host-answer"       , [], answerFields, answerPath)
  , ICECandyUnfurled:   FurlingDescriptor.new("plain", "host-ice-candidate", [],  candyFields,  candyPath)
  };

const RootUnfurls = fromDescriptors(RootDescriptors);

const FromHostRoot = {

  nested: {

    ByeBye: { // bye-bye
      fields: {}
    }

  , Chat: { // chat
      fields: {
        id:      { type: "uint32", id: 1 }
      , message: { type: "string", id: 2 }
      }
    }

  , ChatRelay: { // chat-relay
      fields: {
        id:       { type: "uint32", id: 1 }
      , message:  { type: "string", id: 2 }
      , username: { type: "string", id: 3 }
      }
    }

  , ConnEstablished: { // connection-established
      fields: {
        id:            { type: "uint32", id: 1 }
      , protocolMajor: { type: "uint32", id: 2 }
      , protocolMinor: { type: "uint32", id: 3 }
      , protocolPatch: { type: "uint32", id: 4 }
      }
    }

  , ConnValidation: { // connection-validation
      fields: {
        id:         { type: "uint32", id: 1 }
      , isApproved: { type: "bool"  , id: 2 }
      }
    }

  , HNWBurst: { // hnw-burst
      fields: {
        id:         { type: "uint32", id: 1 }
      , index:      { type: "uint32", id: 2 }
      , fullLength: { type: "uint32", id: 3 }
      , parcel:     { type: "bytes" , id: 4 }
      // Begin jiggery optimizations
      , isMicroBurst: { type: "bool", id: 5 }
      }
    }

  , HostAnswer: { // host-answer
      fields: {
        id:     { type: "uint32", id: 1 }
      , answer: { type: "Answer", id: 2 }
      }
    , nested: {
        Answer: fieldsFrom(answerFields)
      }
    }

  , ICECandy: { // host-ice-candidate
      fields: {
        id:        { type: "uint32"   , id: 1 }
      , candidate: { type: "Candidate", id: 2 }
      }
    , nested: {
        Candidate: fieldsFrom(candyFields)
      }
    }

  , IncorrectPassword: { // incorrect-password
      fields: {
        id: { type: "uint32", id: 1 }
      }
    }

  , InitialModel: { // initial-model
      fields: {
        role:  { type: "Role"       , id: 1 }
      , state: { type: "StateUpdate", id: 2 }
      , view:  { type: "ViewConfig" , id: 3 }
      // Begin jiggery optimizations
      , tokenChunk1: { type: "uint32", id: 4 }
      , tokenChunk2: { type: "uint32", id: 5 }
      , tokenChunk3: { type: "uint32", id: 6 }
      , tokenChunk4: { type: "uint32", id: 7 }
      }
    , nested: {

        Role:        RolePB
      , StateUpdate: SUPB.StateUpdate

      , ViewDims: {
          fields: {
            minPxcor:           { type: "sint32", id: 1 }
          , maxPxcor:           { type: "uint32", id: 2 }
          , minPycor:           { type: "sint32", id: 3 }
          , maxPycor:           { type: "uint32", id: 4 }
          , patchSize:          { type: "double", id: 5 }
          , wrappingAllowedInX: { type: "bool"  , id: 6 }
          , wrappingAllowedInY: { type: "bool"  , id: 7 }
          }
        }

      , ViewUpdateMode: {
          values: {
            TickBased:  0
          , Continuous: 1
          }
        }

      , ViewConfig: {
          fields: {
            id:               { type: "uint32"        , id:  1 }
          , left:             { type: "uint32"        , id:  2 }
          , right:            { type: "uint32"        , id:  3 }
          , top:              { type: "uint32"        , id:  4 }
          , bottom:           { type: "uint32"        , id:  5 }
          , dimensions:       { type: "ViewDims"      , id:  6 }
          , fontSize:         { type: "uint32"        , id:  7 }
          , frameRate:        { type: "uint32"        , id:  8 }
          , showTickCounter:  { type: "bool"          , id:  9 }
          , tickCounterLabel: { type: "string"        , id: 10 }
          , updateMode:       { type: "ViewUpdateMode", id: 11 }
          }
        }

      }
    }

  , KeepAlive: { // keep-alive
      fields: {}
    }

  , LoginSuccessful: { // login-successful
      fields: {
        id: { type: "uint32", id: 1 }
      }
    }

  , NoUsernameGiven: { // no-username-given
      fields: {
        id: { type: "uint32", id: 1 }
      }
    }

  , Ping: { // ping
      fields: {
        id:       { type: "uint32", id: 1 }
      , lastPing: { type: "uint32", id: 2 }
      }
    }

  , TicksStarted: {
      fields: {
        id:              { type: "uint32", id: 1 }
      , hnwTicksStarted: { type: "bool"  , id: 2 }
      }
    }

  , StateUpdate: { // state-update
      fields: {
        update: { type: "SUPB", id: 1 }
      }
    , nested: {
        SUPB: SUPB.StateUpdate
      }
    }

  , UsernameTaken: { // username-already-taken
      fields: {
        id: { type: "uint32", id: 1 }
      }
    }

  , ...RootUnfurls
  , ...SUPB.StateUpdateUnfurls

  }

};

deepFreeze(FromHostRoot);
deepFreeze(RootDescriptors);

export { FromHostRoot, RootDescriptors };

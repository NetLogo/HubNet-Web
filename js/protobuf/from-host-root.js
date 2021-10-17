import { RolePB                        } from "./role.js"
import { StateUpdatePB, StateUpdatePB2 } from "./state-update.js"

const FromHostRoot = {

  nested: {

    ConnEstablished: { // connection-established
      fields: {
        id:              { type: "uint32", id: 1 }
      , protocolVersion: { type: "string", id: 2 }
      }
    }

  , HNWBurst: { // hnw-burst
      fields: {
        id:              { type: "uint32", id: 1 }
      , index:           { type: "uint32", id: 2 }
      , fullLength:      { type: "uint32", id: 3 }
      , parcel:          { type: "bytes" , id: 4 }
      // Begin jiggery optimizations
      , isMicroBurst:    { type: "bool"  , id: 5 }
      }
    }

  , HostAnswer: { // host-answer
      fields: {
        id:     { type: "uint32", id: 1 }
      , answer: { type: "Answer", id: 2 }
      }
    , nested: {
        Answer: {
          fields: {
            type: { type: "string", id: 1 }
          , sdp:  { type: "string", id: 2 }
          }
        }
      }
    }

  , ICECandy: { // host-ice-candidate
      fields: {
        id:        { type: "uint32"   , id: 1 }
      , candidate: { type: "Candidate", id: 2 }
      }
    , nested: {
        Candidate: {
          fields: {
            candidate:     { type: "string", id: 1 }
          , sdpMid:        { type: "string", id: 2 }
          , sdpMLineIndex: { type: "uint32", id: 3 }
          }
        }
      }
    }

  , InitialModel: { // initial-model
      fields: {
        token: { type: "string"     , id: 1 }
      , role:  { type: "Role"       , id: 2 }
      , state: { type: "StateUpdate", id: 3 }
      , view:  { type: "ViewConfig" , id: 4 }
      }
    , nested: {

        Role:        RolePB
      , StateUpdate: StateUpdatePB

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

  , Ping: { // ping
      fields: {
        id: { type: "uint32", id: 1 }
      }
    }

  , PingResult: { // ping-result
      fields: {
        time: { type: "uint32", id: 1 }
      }
    }

  , Relay: { // relay
      fields: {
        id:      { type: "uint32" , id: 1 }
      , payload: { type: "Payload", id: 2 }
      }
    , nested: {
        Payload: {
          oneofs: {
            dataOneOf: {
              oneof: ["hnwTicksStarted"]
            }
          }
        , fields: {
            hnwTicksStarted: { type: "bool", id: 1 }
          }
        }
      }
    }

  , StateUpdate: { // state-update
      fields: {
        update: { type: "SUPB", id: 1 }
      }
    , nested: {
        SUPB: StateUpdatePB2
      }
    }

  }

};

export { FromHostRoot }

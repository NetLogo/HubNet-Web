import { RolePB                        } from "./role.js"
import { StateUpdatePB, StateUpdatePB2 } from "./state-update.js"

const FromHostRoot = {

  nested: {

    ConnEstablished: { // connection-established
      fields: {
        id:              { type: "string", id: 1 }
      , predecessorID:   { type: "string", id: 2 }
      , protocolVersion: { type: "string", id: 3 }
      }
    }

  , HNWBurst: { // hnw-burst
      fields: {
        id:              { type: "string", id: 1 }
      , predecessorID:   { type: "string", id: 2 }
      , protocolVersion: { type: "string", id: 3 }
      , index:           { type: "uint32", id: 4 }
      , fullLength:      { type: "uint32", id: 5 }
      , parcel:          { type: "bytes" , id: 6 }
      }
    }

  , HostAnswer: { // host-answer
      fields: {
        id:              { type: "string", id: 1 }
      , predecessorID:   { type: "string", id: 2 }
      , answer:          { type: "Answer", id: 3 }
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
        id:              { type: "string"   , id: 1 }
      , predecessorID:   { type: "string"   , id: 2 }
      , candidate:       { type: "Candidate", id: 3 }
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
          , maxPxcor:           { type: "sint32", id: 2 }
          , minPycor:           { type: "sint32", id: 3 }
          , maxPycor:           { type: "sint32", id: 4 }
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
        id:            { type: "string", id: 1 }
      , predecessorID: { type: "string", id: 2 }
      }
    }

  , Ping: { // ping
      fields: {
        id: { type: "string", id: 1 }
      }
    }

  , PingResult: { // ping-result
      fields: {
        time: { type: "uint32", id: 1 }
      }
    }

  , Relay: { // relay
      fields: {
        id:            { type: "string" , id: 1 }
      , predecessorID: { type: "string" , id: 2 }
      , payload:       { type: "Payload", id: 3 }
      }
    , nested: {
        Payload: {
          oneofs: {
            dataOneOf: {
              oneof: ["hnwTicksStarted"]
            }
          }
        , fields: {
            token:           { type: "string", id: 1 }
          , protocolVersion: { type: "string", id: 2 }
          , hnwTicksStarted: { type: "bool"  , id: 3 }
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

const hnwPBTransformers =
  [ ["t::relay", "payload", "ticks-started", "hnwTicksStarted"]
  , ["t::initial-model", "role", "widgets**", "hnwButton"  , "button"  ]
  , ["t::initial-model", "role", "widgets**", "hnwChooser" , "chooser" ]
  , ["t::initial-model", "role", "widgets**", "hnwInputBox", "inputBox"]
  , ["t::initial-model", "role", "widgets**", "hnwMonitor" , "monitor" ]
  , ["t::initial-model", "role", "widgets**", "hnwOutput"  , "output"  ]
  , ["t::initial-model", "role", "widgets**", "hnwPlot"    , "plot"    ]
  , ["t::initial-model", "role", "widgets**", "hnwSlider"  , "slider"  ]
  , ["t::initial-model", "role", "widgets**", "hnwSwitch"  , "switch"  ]
  , ["t::initial-model", "role", "widgets**", "hnwTextBox" , "textBox" ]
  , ["t::initial-model", "role", "widgets**", "hnwView"    , "view"    ]
  , ["t::initial-model", "state", "plotUpdates", "$$**", "add-point"       , "addPoint"      ]
  , ["t::initial-model", "state", "plotUpdates", "$$**", "reset"           , "reset"         ]
  , ["t::initial-model", "state", "plotUpdates", "$$**", "reset-pen"       , "resetPen"      ]
  , ["t::initial-model", "state", "plotUpdates", "$$**", "register-pen"    , "registerPen"   ]
  , ["t::initial-model", "state", "plotUpdates", "$$**", "update-pen-color", "updatePenColor"]
  , ["t::initial-model", "state", "plotUpdates", "$$**", "update-pen-mode" , "updatePenMode" ]
  , ["t::state-update"          , "plotUpdates", "$$**", "add-point"       , "addPoint"      ]
  , ["t::state-update"          , "plotUpdates", "$$**", "reset"           , "reset"         ]
  , ["t::state-update"          , "plotUpdates", "$$**", "reset-pen"       , "resetPen"      ]
  , ["t::state-update"          , "plotUpdates", "$$**", "register-pen"    , "registerPen"   ]
  , ["t::state-update"          , "plotUpdates", "$$**", "update-pen-color", "updatePenColor"]
  , ["t::state-update"          , "plotUpdates", "$$**", "update-pen-mode" , "updatePenMode" ]
  ];

export { FromHostRoot, hnwPBTransformers }
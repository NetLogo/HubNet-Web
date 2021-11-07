const fakeDimensions =
  { minPxcor:           0
  , maxPxcor:           0
  , minPycor:           0
  , maxPycor:           0
  , patchSize:          1
  , wrappingAllowedInX: true
  , wrappingAllowedInY: true
  };

const fakeView =
  { bottom:           0
  , compilation:      { success: true, messages: [] }
  , dimensions:       fakeDimensions
  , fontSize:         10
  , frameRate:        30
  , id:               0
  , left:             0
  , right:            0
  , showTickCounter:  true
  , tickCounterLabel: "ticks"
  , top:              0
  , type:             "view"
  , updateMode:       "TickBased"
  };

const fakeRole =
  { canJoinMidRun: true
  , isSpectator:   true
  , limit:         -1
  , name:          "fake role"
  , onConnect:     ""
  , onCursorClick: null
  , onCursorMove:  null
  , onDisconnect:  ""
  , widgets:       [fakeView]
  };

const fakeModel =
  { role:     fakeRole
  , token:    "invalid token"
  , type:     "hnw-load-interface"
  , username: "no username"
  , view:     fakeView
  };

export default fakeModel;

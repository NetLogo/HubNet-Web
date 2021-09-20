window.FromJoinerRoot = {

  nested: {

    ByeBye: { // bye-bye
      fields: {
        id:            { type: "string", id: 1 }
      , predecessorID: { type: "string", id: 2 }
      }
    }

  , ConnEstablished: { // connection-established
      fields: {
        id:              { type: "string", id: 1 }
      , predecessorID:   { type: "string", id: 2 }
      , protocolVersion: { type: "string", id: 3 }
      }
    }

  , ICECandy: { // joiner-ice-candidate
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

  , JoinerOffer: { // joiner-offer
      fields: {
        id:              { type: "string", id: 1 }
      , predecessorID:   { type: "string", id: 2 }
      , offer:           { type: "Offer" , id: 3 }
      }
    , nested: {
        Offer: {
          fields: {
            type: { type: "string", id: 1 }
          , sdp:  { type: "string", id: 2 }
          }
        }
      }
    }

  , Login: { // login
      fields: {
        id:            { type: "string", id: 1 }
      , predecessorID: { type: "string", id: 2 }
      , username:      { type: "string", id: 3 }
      , password:      { type: "string", id: 4 }
      }
    }

  , Pong: { // pong
      fields: {
        id: { type: "string", id: 1 }
      }
    }

  , Relay: { // relay
      fields: {
        id:            { type: "string" , id: 1 }
      , predecessorID: { type: "string" , id: 2 }
      , payload:       { type: "Payload", id: 3 }
      }
    , nested: {
        Payload: window.JoinerRelayPayloadPB
      }
    }
  }

};

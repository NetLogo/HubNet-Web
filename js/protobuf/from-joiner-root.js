import { JoinerRelayPayloadPB, RelayUnfurls } from "./joiner-relay-payload.js"

const FromJoinerRoot = {

  nested: {

    ByeBye: { // bye-bye
      fields: {
        id: { type: "uint32", id: 1 }
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

  , ICECandy: { // joiner-ice-candidate
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

  , JoinerOffer: { // joiner-offer
      fields: {
        id:    { type: "uint32", id: 1 }
      , offer: { type: "Offer" , id: 2 }
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
        id:       { type: "uint32", id: 1 }
      , username: { type: "string", id: 2 }
      , password: { type: "string", id: 3 }
      }
    }

  , Pong: { // pong
      fields: {
        id: { type: "uint32", id: 1 }
      }
    }

  , Relay: { // relay
      fields: {
        id:      { type: "uint32" , id: 1 }
      , payload: { type: "Payload", id: 2 }
      }
    , nested: {
        Payload: JoinerRelayPayloadPB
      }
    }

  , ...RelayUnfurls

  }

};

export { FromJoinerRoot }

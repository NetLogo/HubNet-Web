import { protobuf } from "/assets/js/protobuf.min.js"

import { FromHostRoot   } from "./from-host-root.js"
import { FromJoinerRoot } from "./from-joiner-root.js"

import * as FromHost   from "./from-host-jiggery-pokery.js"
import * as FromJoiner from "./from-joiner-jiggery-pokery.js"

// Section: Common
const hubNetWebLookup = (root) => (x) => root.lookupType(x);

let encodePBuf = (isHost) => (msg) => {

  let typeMap   = isHost ? fromHostTypeMap : fromJoinerTypeMap;
  let protoType = typeMap[msg.type];
  let typeCode  = Object.keys(typeMap).findIndex((x) => x === msg.type);

  if (protoType !== null && typeCode !== null) {

    const rejiggered = (isHost ? FromHost : FromJoiner).rejigger(msg);

    let protoMsg = protoType.fromObject(rejiggered, { enums: String });
    let errorMsg = protoType.verify(protoMsg);

    if (errorMsg !== null) {
      let fullError = `Protobuf Error: ${errorMsg}`;
      alert(fullError);
    }

    let writer = protobuf.Writer.create();
    writer.uint32(typeCode);

    return protoType.encode(protoMsg, writer).finish();

  }

};

let decodePBuf = (isHost) => (msgBuf) => {
  let typeMap           = isHost ? fromJoinerTypeMap : fromHostTypeMap;
  let [type, protoType] = Object.entries(typeMap)[msgBuf[0]];
  let decoded           = protoType.decode(msgBuf.slice(1));
  let decodedObj        = protoType.toObject(decoded, { enums: String });
  let reconstructed     = { type, ...decodedObj };
  let recombobulated    = (isHost ? FromJoiner : FromHost).recombobulate(reconstructed);
  return recombobulated;
};

// Section: Host
const fromHostRoot = protobuf.Root.fromJSON(FromHostRoot);

const lufhr = hubNetWebLookup(fromHostRoot);

let fromHostTypeMap =
  { "connection-established": lufhr("ConnEstablished")
  , "hnw-burst":              lufhr("HNWBurst")
  , "host-answer":            lufhr("HostAnswer")
  , "host-ice-candidate":     lufhr("ICECandy")
  , "initial-model":          lufhr("InitialModel")
  , "keep-alive":             lufhr("KeepAlive")
  , "login-successful":       lufhr("LoginSuccessful")
  , "ping":                   lufhr("Ping")
  , "ping-result":            lufhr("PingResult")
  , "relay":                  lufhr("Relay")
  , "state-update":           lufhr("StateUpdate")
  };

// Section: Joiner
const fromJoinerRoot = protobuf.Root.fromJSON(FromJoinerRoot);

const lufjr = hubNetWebLookup(fromJoinerRoot);

let fromJoinerTypeMap =
  { "bye-bye":                lufjr("ByeBye"         )
  , "connection-established": lufjr("ConnEstablished")
  , "joiner-ice-candidate":   lufjr("ICECandy"       )
  , "joiner-offer":           lufjr("JoinerOffer"    )
  , "login":                  lufjr("Login"          )
  , "pong":                   lufjr("Pong"           )
  , "relay":                  lufjr("Relay"          )
  };

export { decodePBuf, encodePBuf }

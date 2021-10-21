import { protobuf } from "/assets/js/protobuf.min.js"

import { inflate, deflate } from "/assets/js/pako.esm.mjs"

import { FromHostRoot   } from "./from-host-root.js"
import { FromJoinerRoot } from "./from-joiner-root.js"

import * as FromHost   from "./from-host-jiggery-pokery.js"
import * as FromJoiner from "./from-joiner-jiggery-pokery.js"

// Section: Common
const hubNetWebLookup = (root) => (x) => root.lookupType(x);

const encodePBuf = (isHost) => (msg) => {

  const typeMap   = isHost ? fromHostTypeMap : fromJoinerTypeMap;
  const protoType = typeMap[msg.type];
  const typeCode  = Object.keys(typeMap).findIndex((x) => x === msg.type);

  if (protoType !== null && typeCode !== null) {

    console.log("About to rejigger", msg);
    const rejiggered = (isHost ? FromHost : FromJoiner).rejigger(msg);
    console.log("Done to rejigger", rejiggered);

    const protoMsg = protoType.fromObject(rejiggered, { enums: String });
    const errorMsg = protoType.verify(protoMsg);

    if (errorMsg !== null) {
      const fullError = `Protobuf Error: ${errorMsg}`;
      alert(fullError);
    }

    const writer = protobuf.Writer.create();
    writer.uint32(typeCode);

    const encoded    = protoType.encode(protoMsg, writer).finish();
    const compressed = deflate(encoded);

    return compressed;

  }

};

const decodePBuf = (isHost) => (compressedMsg) => {
  const msgBuf            = inflate(compressedMsg);
  const typeMap           = isHost ? fromJoinerTypeMap : fromHostTypeMap;
  const [type, protoType] = Object.entries(typeMap)[msgBuf[0]];
  const decoded           = protoType.decode(msgBuf.slice(1));
  const decodedObj        = protoType.toObject(decoded, { enums: String });
  const reconstructed     = { type, ...decodedObj };
  console.log("About to recombobulate", reconstructed);
  const recombobulated    = (isHost ? FromJoiner : FromHost).recombobulate(reconstructed);
  console.log("Done to recombobulate", recombobulated);
  return recombobulated;
};

// Section: Host
const fromHostRoot = protobuf.Root.fromJSON(FromHostRoot);

const lufhr = hubNetWebLookup(fromHostRoot);

const fromHostTypeMap =
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

const fromJoinerTypeMap =
  { "bye-bye":                lufjr("ByeBye"         )
  , "connection-established": lufjr("ConnEstablished")
  , "joiner-ice-candidate":   lufjr("ICECandy"       )
  , "joiner-offer":           lufjr("JoinerOffer"    )
  , "login":                  lufjr("Login"          )
  , "pong":                   lufjr("Pong"           )
  , "relay":                  lufjr("Relay"          )
  };

export { decodePBuf, encodePBuf }

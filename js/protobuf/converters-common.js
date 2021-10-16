import { protobuf } from "/assets/js/protobuf.min.js"

import { FromHostRoot   } from "./from-host-root.js"
import { FromJoinerRoot } from "./from-joiner-root.js"

import * as Host   from "./from-host-root.js";
import * as Joiner from "./from-joiner-root.js";

// Section: Common
const hubNetWebLookup = (root) => (x) => root.lookupType(x);

const transform = (transformer, msg) => {

  const helper = (paths, lens, replacement) => {
    if (paths.length === 1) {
      if (lens.type === paths[0]) {
        let clone = Object.assign({}, lens);
        Object.getOwnPropertyNames(lens).forEach((p) => delete lens[p]);
        lens[replacement] = clone;
      }
    } else if (paths.length > 1) {
      const head = paths.shift();
      if (head === "$$") {
        Object.values(lens).forEach((l) => helper(paths, l, replacement));
      } else if (head === "$$**") {
        Object.values(lens).forEach((l) => l.forEach((l2) => helper(paths, l2, replacement)));
      } else if (head.endsWith("**")) {
        const trueHead = head.slice(0, -2);
        if (lens[trueHead] !== undefined) {
          lens[trueHead].forEach((l) => helper(paths, l, replacement));
        }
      } else if (head.startsWith("t::")) {
        if (lens.type === head.slice(3)) {
          helper(paths, lens, replacement);
        }
      } else if (lens[head] !== undefined) {
        helper(paths, lens[head], replacement);
      }
    } else {
      console.error(`Unable to perform transformation ${transformer} in ${JSON.stringify(msg)}`);
    }
  };

  helper(transformer, msg, transformer.pop());

};

const detransform = (transformer, msg) => {

  const helper = (paths, lens, type) => {
    if (paths.length === 1) {
      if (lens[paths[0]] !== undefined) {
        let orig = lens[paths[0]];
        delete lens[paths[0]];
        Object.assign(lens, orig);
        lens.type = type;
      }
    } else if (paths.length > 1) {
      const head = paths.shift();
      if (head === "$$") {
        Object.values(lens).forEach((l) => helper(paths, l, type));
      } else if (head === "$$**") {
        // The `Array.from` should be unnecessary, and is to deal with getting PlotUpdates
        // over the wire that should be arrays and are, instead, empty objects
        Object.values(lens).forEach((l) => Array.from(l).forEach((l2) => helper(paths, l2, type)));
      } else if (head.endsWith("**")) {
        const trueHead = head.slice(0, -2);
        if (lens[trueHead] !== undefined) {
          lens[trueHead].forEach((l) => helper(paths, l, type));
        }
      } else if (head.startsWith("t::")) {
        if (lens.type === head.slice(3)) {
          helper(paths, lens, type);
        }
      } else if (lens[head] !== undefined) {
        helper(paths, lens[head], type);
      }
    } else {
      console.error(`Unable to perform detransformation ${transformer} in ${JSON.stringify(msg)}`);
    }
  };

  const [r] = transformer.splice(transformer.length - 2, 1);
  helper(transformer, msg, r);

};

const swapFunkyPathsIn = (msg, isHost) => {
  let formers = isHost ? Host.hnwPBTransformers : Joiner.hnwPBTransformers;
  formers.forEach((x) => transform(x.slice(0), msg));
};

const swapFunkyPathsOut = (msg, isHost) => {
  let formers = isHost ? Joiner.hnwPBTransformers : Host.hnwPBTransformers;
  formers.forEach((x) => detransform(x.slice(0), msg));
};

let encodePBuf = (isHost) => (msg) => {

  let typeMap   = isHost ? fromHostTypeMap : fromJoinerTypeMap;
  let protoType = typeMap[msg.type];
  let typeCode  = Object.keys(typeMap).findIndex((x) => x === msg.type);

  if (protoType !== null && typeCode !== null) {

    swapFunkyPathsIn(msg, isHost);
    let protoMsg = protoType.fromObject(msg, { enums: String });
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
  swapFunkyPathsOut(reconstructed, isHost);
  return reconstructed;
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

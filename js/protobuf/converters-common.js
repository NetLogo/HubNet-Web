import { protobuf } from "/assets/js/protobuf.min.js"

import { inflate, deflate } from "/assets/js/pako.esm.mjs"

import * as FromHostJP   from "./from-host-jiggery-pokery.js"
import * as FromJoinerJP from "./from-joiner-jiggery-pokery.js"

import * as FromHostFurler   from "./from-host-furling.js"
import * as FromJoinerFurler from "./from-joiner-furling.js"

// Section: Common
const encodePBuf = (isHost) => (msg) => {

  console.log("About to rejigger", msg);
  const rejiggered = (isHost ? FromHostJP : FromJoinerJP).rejigger(msg);
  console.log("Done to rejigger", rejiggered);

  const [preppedMsg, protoType, typeCode] =
    (isHost ? FromHostFurler : FromJoinerFurler).unfurl(rejiggered);

  const protoMsg = protoType.fromObject(preppedMsg, { enums: String });
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

};

const decodePBuf = (isHost) => (compressedMsg) => {
  const furler            = isHost ? FromJoinerFurler : FromHostFurler
  const msgBuf            = inflate(compressedMsg);
  const [type, protoType] = furler.lookupTypeCode(msgBuf[0]);
  const decoded           = protoType.decode(msgBuf.slice(1));
  const decodedObj        = protoType.toObject(decoded, { enums: String });
  const reconstructed     = { type, ...decodedObj };
  const furled            = furler.furl(reconstructed);
  console.log("About to recombobulate", reconstructed);
  const recombobulated    = (isHost ? FromJoinerJP : FromHostJP).recombobulate(furled);
  console.log("Done to recombobulate", recombobulated);
  return recombobulated;
};

export { decodePBuf, encodePBuf }

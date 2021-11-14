import { protobuf } from "/assets/js/protobuf.min.js";

import { inflate, deflate } from "/depend/js/pako.esm.mjs";

import * as FromHostJP   from "./from-host-jiggery-pokery.js";
import * as FromJoinerJP from "./from-joiner-jiggery-pokery.js";

import * as FromHostFurler   from "./from-host-furling.js";
import * as FromJoinerFurler from "./from-joiner-furling.js";

const cMask = 0b10000000; // Number

// (String) => (() => Unit) => Unit
const trace = (type) => (f) => {
  const debugBlacklist = ["ping", "pong", "keep-alive"];
  if (!debugBlacklist.includes(type)) {
    f();
  }
};

// (Boolean) => (Object[Any]) => Uint8Array
/* eslint-disable no-bitwise */
const encodePBuf = (isHost) => (msg) => {

  trace(msg.type)(() => console.log("About to rejigger", msg));
  const rejiggered = (isHost ? FromHostJP : FromJoinerJP).rejigger(msg);
  trace(msg.type)(() => console.log("Done to rejigger", rejiggered));

  const [preppedMsg, protoType, typeCode] =
    (isHost ? FromHostFurler : FromJoinerFurler).unfurl(rejiggered);

  const protoMsg = protoType.fromObject(preppedMsg, { enums: String });
  const errorMsg = protoType.verify(protoMsg);

  if (errorMsg !== null) {
    const fullError = `Protobuf Error: ${errorMsg}`;
    alert(fullError);
  }

  const writer     = protobuf.Writer.create();
  const encoded    = protoType.encode(protoMsg, writer).finish();
  const compressed = deflate(encoded);

  const mask = (x) => x | cMask;

  const [maskedCode, buffer] =
    (compressed.byteLength < encoded.byteLength) ? [mask(typeCode), compressed] :
                                                   [     typeCode , encoded   ];

  const outBuffer = new Uint8Array(buffer.length + 1);
  outBuffer[0]    = maskedCode;
  outBuffer.set(buffer, 1);

  return outBuffer;

};

// (Boolean) => (Uint8Array) => Object[Any]
const decodePBuf = (isHost) => (byteStream) => {

  const furler        = isHost ? FromJoinerFurler : FromHostFurler;
  const jiggeryPokery = isHost ? FromJoinerJP     : FromHostJP;

  const initialCode = byteStream[0];
  const dataStream  = byteStream.slice(1);

  const unmask = (x) => x & 0b01111111;

  const isRaw = (initialCode & cMask) !== cMask;

  const typeCode          = isRaw ? initialCode : unmask (initialCode);
  const msgBuf            = isRaw ?  dataStream : inflate( dataStream);
  const [type, protoType] = furler.lookupTypeCode(typeCode);
  const decoded           = protoType.decode(msgBuf);
  const decodedObj        = protoType.toObject(decoded, { enums: String });
  const reconstructed     = { type, ...decodedObj };
  const furled            = furler.furl(reconstructed);
  trace(type)(() => console.log("About to recombobulate", reconstructed, furled));
  const recombobulated    = jiggeryPokery.recombobulate(furled);
  trace(type)(() => console.log("Done to recombobulate", recombobulated));

  return recombobulated;

};
/* eslint-enable no-bitwise */

export { decodePBuf, encodePBuf };

import { protobuf } from "/assets/js/protobuf.min.js";

import { inflate, deflate } from "/depend/js/pako.esm.mjs";

import * as FromHostJP   from "./jigpoke/from-host-jiggery-pokery.js";
import * as FromJoinerJP from "./jigpoke/from-joiner-jiggery-pokery.js";

import * as FromHostFurler   from "./furl/from-host-furling.js";
import * as FromJoinerFurler from "./furl/from-joiner-furling.js";

const  cMask  = 0b10000000; // Number
const  cMaskF = 0b01111111; // Number

const mbMask  = 0b01000000; // Number
const mbMaskF = 0b10111111; // Number

const mbidMask  = 0b10000000; // Number
const mbidMaskF = 0b01111111; // Number

// (String) => (() => Unit) => Unit
const trace = (type) => (f) => {
  const debugBlacklist = ["ping", "pong", "keep-alive"];
  if (!debugBlacklist.includes(type)) {
    f();
  }
};

// (Boolean) => (Object[Any]) => Uint8Array
/* eslint-disable no-bitwise */
const serialize = (isHost) => (msg) => {

  const isMicroBurst = msg.microBurstID !== undefined;
  const mbID         = msg.microBurstID;
  const paren        = isMicroBurst ? " (micro-burst)" : "";

  trace(msg.type)(() => console.log(`About to rejigger${paren}`, msg));
  if (isMicroBurst) { delete msg.microBurstID; }
  const rejiggered = (isHost ? FromHostJP : FromJoinerJP).rejigger(msg);
  trace(msg.type)(() => console.log(`Rejiggering complete${paren}`, rejiggered));

  const [preppedMsg, protoType, typeCode] =
    (isHost ? FromHostFurler : FromJoinerFurler).unfurl(rejiggered);

  const writer     = protobuf.Writer.create();
  const protoMsg   = protoType.fromObject(preppedMsg, { enums: String });
  const encoded    = protoType.encode(protoMsg, writer).finish();
  const compressed = deflate(encoded);

  const mask = (x) => x | cMask;

  const [cMaskedCode, buffer] =
    (compressed.byteLength < encoded.byteLength) ? [mask(typeCode), compressed] :
                                                   [     typeCode , encoded   ];

  const maskedCode = isMicroBurst ? (cMaskedCode | mbMask) : cMaskedCode;
  const mbIDBytes  = isMicroBurst ? encodeMBID(mbID) : [];

  const outBuffer = new Uint8Array(mbIDBytes.length + buffer.length + 1);
  outBuffer[0]    = maskedCode;
  outBuffer.set(mbIDBytes, 1);
  outBuffer.set(buffer   , 1 + mbIDBytes.length);

  return outBuffer;

};

// (Boolean) => (Uint8Array) => Object[Any]
const deserialize = (isHost) => (byteStream) => {

  const furler        = isHost ? FromJoinerFurler : FromHostFurler;
  const jiggeryPokery = isHost ? FromJoinerJP     : FromHostJP;

  const initialCode = byteStream[0];
  const dataStream  = byteStream.slice(1);

  const unmask = (x) => x & cMaskF & mbMaskF;

  const isRaw        = (initialCode &  cMask) !==  cMask;
  const isMicroBurst = (initialCode & mbMask) === mbMask;

  if (isMicroBurst) {

    const [id, innerParcel] = snapOffID(dataStream);
    const newCode           = initialCode & mbMaskF;
    const parcel            = new Uint8Array(innerParcel.length + 1);

    parcel[0] = newCode;
    parcel.set(innerParcel, 1);

    const burst = { type: "hnw-burst", index: 0, fullLength: 1, id, parcel };
    trace("hnw-burst")(() => console.log("Reconstructed burst", burst));
    return burst;

  } else {

    const typeCode          = unmask(initialCode);
    const msgBuf            = isRaw ? dataStream : inflate(dataStream);
    const [type, protoType] = furler.lookupTypeCode(typeCode);
    const decoded           = protoType.decode(msgBuf);
    const decodedObj        = protoType.toObject(decoded, { enums: String });
    const reconstructed     = { type, ...decodedObj };
    const furled            = furler.furl(reconstructed);
    trace(type)(() => console.log("About to recombobulate", reconstructed, furled));
    const recombobulated    = jiggeryPokery.recombobulate(furled);
    trace(type)(() => console.log("Recombobulation complete", recombobulated));

    return recombobulated;

  }

};

// (Number) => Uint8Array
const encodeMBID = (id) => {

  if (id !== 0) {

    const bytes = [  id        & mbidMaskF
                  , (id >>  7) & mbidMaskF
                  , (id >> 14) & mbidMaskF
                  , (id >> 21) & mbidMaskF
                  , (id >> 28) & 0b1111
                  ];

    while (bytes[bytes.length - 1] === 0) {
      bytes.pop();
    }

    bytes[bytes.length - 1] = bytes[bytes.length - 1] | mbidMask;

    return bytes;

  } else {
    return [mbidMask];
  }

};

// (Uint8Array) => (Number, Uint8Array)
const snapOffID = (bytes) => {

  const idBytes = [];

  let i         = 0;
  let keepGoing = true;

  while (keepGoing) {
    const unmasked = bytes[i] & mbidMaskF;
    idBytes.push(unmasked);
    keepGoing = bytes[i] === unmasked;
    i++;
  }

  const snapped = bytes.slice(i);

  let id = 0;

  // We must use a power of 2 here, rather than bitshifting!
  // (0b1111 << 28)     => Some nonsense negative number
  // (0b1111 * 2 ** 28) => Something totally legit
  // I want to blame JS, but I actually can't.
  // This is just how IEEE math works....  --Jason B. (12/2/21)
  for (let j = idBytes.length - 1; j >= 0; j--) {
    id += idBytes[j] * (2 ** (7 * j));
  }

  return [id, snapped];

};
/* eslint-enable no-bitwise */

export { deserialize, serialize };

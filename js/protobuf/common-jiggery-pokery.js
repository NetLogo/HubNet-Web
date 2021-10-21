// (String, Object[Any]) => Unit
const rejiggerToken = (token, parent) => {

  const uuidRegex = /(........)-(....)-(4...)-(....)-(....)(........)/;
  const [_, a, b, c, d, e, f] = token.match(uuidRegex);

  // Must be broken into at least 3 parts.  There are 32 digits
  // in the hex number, and attempts to run `parseInt` on 16-digit
  // numbers will often produce rounding errors in the lowest digits.
  //
  // Also, the reason the segments are broken up into 8-digit chunks
  // is because that then allows us to stick these into uint32s,
  // rather than uint64s.
  //
  // --Jason B. (10/17/21)
  const chunk1 = parseInt(a         , 16);
  const chunk2 = parseInt(`${b}${c}`, 16);
  const chunk3 = parseInt(`${d}${e}`, 16);
  const chunk4 = parseInt(f         , 16);

  parent.tokenChunk1 = chunk1;
  parent.tokenChunk2 = chunk2;
  parent.tokenChunk3 = chunk3;
  parent.tokenChunk4 = chunk4;

};

// (String, Object[Any]) => Unit
const recombobulateToken = (target, parent) => {

  const toHex = (numDigits) => (x) => {
    return x.toString(16).padStart(numDigits, '0');
  };

  const toHex8 = toHex(8);

  const chunk1 = toHex8(target.tokenChunk1);
  const chunk2 = toHex8(target.tokenChunk2);
  const chunk3 = toHex8(target.tokenChunk3);
  const chunk4 = toHex8(target.tokenChunk4);

  const uuid1Regex = /(........)/;
  const uuid2Regex = /(....)(4...)/;
  const uuid3Regex = /(....)(....)/;
  const uuid4Regex = /(........)/;

  const [x, a   ] = chunk1.match(uuid1Regex);
  const [y, b, c] = chunk2.match(uuid2Regex);
  const [z, d, e] = chunk3.match(uuid3Regex);
  const [_, f   ] = chunk4.match(uuid4Regex);

  parent.token = `${a}-${b}-${c}-${d}-${e}${f}`;

};

// (String, Any, Object[Any], (((String, Any) => Boolean, (String, Any) => Any))) => Any
const applyTransforms = (key, value, obj, condPairs) => {
  if (condPairs.length === 0) {
    return value;
  } else {
    if (condPairs[0][0](key, value)) {
      return condPairs[0][1](key, value);
    } else {
      return applyTransforms(key, value, obj, condPairs.slice(1));
    }
  }
};

// (Object[Any], (((String, Any) => Boolean, (String, Any) => Any)), Boolean, Object[_]) => Object[Any]
const transformativeClone = (obj, condPairs, shouldLowerCase, whitelist) => {
  const clone = obj.length !== undefined ? [] : {};
  for (let key in obj) {
    const value    = obj[key];
    const trueKey  = (shouldLowerCase && whitelist[key] === undefined) ? key.toLowerCase() : key;
    clone[trueKey] = applyTransforms(key, value, obj, condPairs);
  }
  return clone;
};

// (Object[Any], Boolean, Object[_]) => Object[Any]
const innerClone = (obj, shouldLowerCase, whitelist) => {

  const allowsNulls = [ ((k, v) => v === null)
                      , ((k, v) => v)
                      ];

  const ignoresBuffers = [ ((k, v) => v.length !== undefined || v.byteLength !== undefined)
                         , ((k, v) => v)
                         ];

  const deeplyClonesObjs = [ ((k, v) => typeof(v) === "object")
                           , ((k, v) => innerClone(v, shouldLowerCase, whitelist))
                           ];

  const pairs = [allowsNulls, ignoresBuffers, deeplyClonesObjs];

  return transformativeClone(obj, pairs, shouldLowerCase, whitelist);

};

// (Object[Any], Boolean, Object[_]) => Object[Any]
const deepClone = (x, shouldLowerCase = false, whitelist = {}) => {
  return (typeof(x) !== "object") ? x : innerClone(x, shouldLowerCase, whitelist);
};

export { deepClone, recombobulateToken, rejiggerToken }

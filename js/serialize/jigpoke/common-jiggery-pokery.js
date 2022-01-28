// (Object[Any]) => (String, (Any) => Any) => Unit
const transform = (obj) => (key, f) => {
  if (obj[key] !== undefined) {
    obj[key] = f(obj[key]);
  }
};

// (UUID) => (Number, Number, Number, Number)
const rejiggerUUID = (uuid) => {

  const uuidRegex = /(........)-(....)-(4...)-(....)-(....)(........)/;
  const [ , a, b, c, d, e, f] = uuid.match(uuidRegex);

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

  return [chunk1, chunk2, chunk3, chunk4];

};

// (String, Object[Any]) => Unit
const rejiggerToken = (token, parent) => {

  const [chunk1, chunk2, chunk3, chunk4] = rejiggerUUID(token);

  parent.tokenChunk1 = chunk1;
  parent.tokenChunk2 = chunk2;
  parent.tokenChunk3 = chunk3;
  parent.tokenChunk4 = chunk4;

};

// (Number, Number, Number, Number) => UUID
const recombobulateUUID = (part1, part2, part3, part4) => {

  const toHex = (numDigits) => (x) => {
    return x.toString(16).padStart(numDigits, "0");
  };

  const toHex8 = toHex(8);

  const chunk1 = toHex8(part1);
  const chunk2 = toHex8(part2);
  const chunk3 = toHex8(part3);
  const chunk4 = toHex8(part4);

  const uuid1Regex = /(........)/;
  const uuid2Regex = /(....)(4...)/;
  const uuid3Regex = /(....)(....)/;
  const uuid4Regex = /(........)/;

  const [ , a   ] = chunk1.match(uuid1Regex);
  const [ , b, c] = chunk2.match(uuid2Regex);
  const [ , d, e] = chunk3.match(uuid3Regex);
  const [ , f   ] = chunk4.match(uuid4Regex);

  return `${a}-${b}-${c}-${d}-${e}${f}`;

};

// (String, Object[Any]) => Unit
const recombobulateToken = (target, parent) => {

  const token =
    recombobulateUUID( target.tokenChunk1, target.tokenChunk2
                     , target.tokenChunk3, target.tokenChunk4);

  parent.token = token;

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

// (Object[Any], Array[(((String, Any) => Boolean, (String, Any) => Any))], Object[_], Boolean, Object[_]) => Object[Any]
const transformativeClone = (obj, condPairs, blacklist, shouldLower, whitelist) => {
  const clone = (obj.length !== undefined) ? [] : {};
  for (const key in obj) {
    if (blacklist[key] === undefined) {
      const value       = obj[key];
      const isLowerable = shouldLower && whitelist[key] === undefined;
      const trueKey     = isLowerable ? key.toLowerCase() : key;
      clone[trueKey]    = applyTransforms(key, value, obj, condPairs);
    }
  }
  return clone;
};

// (Object[Any], Object[_], Boolean, Object[_]) => Object[Any]
const innerClone = (obj, blacklist, shouldLowerCase, whitelist) => {

  const allowsUndefs = [ ((k, v) => v === undefined)
                       , ((k, v) => v)
                       ];

  const allowsNulls = [ ((k, v) => v === null)
                      , ((k, v) => v)
                      ];

  const ignoresBuffers = [ ((k, v) => v.length     !== undefined ||
                                      v.byteLength !== undefined)
                         , ((k, v) => v)
                         ];

  const deeplyClonesObjs = [ ((k, v) => typeof(v) === "object")
                           , ((k, v) => innerClone(v, blacklist, shouldLowerCase, whitelist))
                           ];

  const pairs = [allowsUndefs, allowsNulls, ignoresBuffers, deeplyClonesObjs];

  return transformativeClone(obj, pairs, blacklist, shouldLowerCase, whitelist);

};

// (Object[Any], Object[_], Boolean, Object[_]) => Object[Any]
const deepClone = (x, blacklist = {}, shouldLowerCase = false, whitelist = {}) => {
  return (typeof(x) !== "object") ? x : innerClone(x, blacklist, shouldLowerCase, whitelist);
};

export { deepClone, recombobulateToken, rejiggerToken
       , recombobulateUUID, rejiggerUUID, transform };

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

// (Object[Any], (((String, Any) => Boolean, (String, Any) => Any))) => Object[Any]
const transformativeClone = (obj, condPairs) => {
  const clone = {};
  for (let key in obj) {
    const value = obj[key];
    clone[key] = applyTransforms(key, value, obj, condPairs);
  }
  return clone;
};

// (Object[Any]) => Object[Any]
const innerClone = (obj) => {

  const ignoresBuffers = [ ((k, v) => v.byteLength !== undefined)
                         , ((k, v) => v)
                         ];

  const deeplyClonesObjs = [ ((k, v) => typeof(v) === "object")
                           , ((k, v) => innerClone(v))
                           ];

  const pairs = [ignoresBuffers, deeplyClonesObjs];

  return transformativeClone(obj, pairs);

};

const deepClone = (x) => {
  return (typeof(x) !== "object") ? x : innerClone(x);
};

export { deepClone }

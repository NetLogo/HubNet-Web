const MinID = 0;
const MaxID = (2 ** 32) - 1;

// (Number) => Number
const nextID = (num) => {
  return (num === MaxID) ? MinID : num + 1;
};

// (Number) => Number
const prevID = (num) => {
  return (num === MinID) ? MaxID : num - 1;
};

// This logic's a bit funky, because we're supporting ID numbers wrapping
// back around. --Jason B. (10/29/21)
//
// (Number, Number) => Boolean
const precedesID = (target, ref) => {
  const maxDist     = 20;
  const wrappedDist = (ref + maxDist) - ((target + maxDist) % MaxID);
  return (target !== ref) &&
         wrappedDist >= MinID &&
         wrappedDist < (MinID + maxDist);
};

// (Number, Number) => Boolean
const succeedsID = (target, ref) => precedesID(ref, target);

export { MaxID, MinID, nextID, precedesID, prevID, succeedsID };

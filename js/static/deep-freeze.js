// This is the only function that should live in the 'static' package.
// It is here only because the 'static' package should be depending on
// as few other packages as possible (preferably: zero).
//
// --Jason B. (11/18/21)

// (Object[Any]) => Object[Any]
export default function deepFreeze(obj) {

  const keys = Object.getOwnPropertyNames(obj);

  for (const key of keys) {
    const value = obj[key];
    if (value !== null && typeof(value) === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);

}

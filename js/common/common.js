const HNWProtocolVersionNumber = "0.0.1"; // String

// (Number, Number) => String
const byteSizeLabel = (n, precision = 2) => {
  const trunc = (x) => parseFloat(x.toFixed(precision));
  return (n >= 1e8) ? `${trunc(n / 1e9)} GB` :
         (n >= 1e5) ? `${trunc(n / 1e6)} MB` :
         (n >= 1e2) ? `${trunc(n / 1e3)} KB` :
                      `${trunc(n)} B`;
};

// (String) => String
/* eslint-disable no-bitwise */
const stringToHash = (str) => {
  const toCodePoint = (x)      => x.codePointAt(0);
  const toHash      = (acc, x) => (((acc << 5) - acc) + x) | 0;
  return Array.from(str).map(toCodePoint).reduce(toHash, 0);
};
/* eslint-enable no-bitwise */

// (String) => Number
const uuidToRTCID = (uuid) => {
  // The docs say that the limit on the number of channels is 65534,
  // but Chromium barfs if the ID is 1024 or higher --Jason B. (7/15/19)
  // Oh, you think Chromium's bad?  Firefox only allows 256! --Jason B. (5/13/21)
  return Math.abs(stringToHash(uuid)) % 256;
};

// (String) => Boolean
const typeIsOOB = (type) => {
  return ["keep-alive", "ping", "pong"].includes(type);
};

// () => UUID
/* eslint-disable no-bitwise */
const genUUID = () => {

  const replacer =
    (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    };

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, replacer);

};
/* eslint-enable no-bitwise */

export { byteSizeLabel, genUUID, HNWProtocolVersionNumber, typeIsOOB, uuidToRTCID };

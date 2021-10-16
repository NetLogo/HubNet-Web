const HNWProtocolVersionNumber = "0";

// (String) => String
const stringToHash = (str) => {
  return Array.from(str).map((x) => x.codePointAt(0)).reduce(((acc, x) => (((acc << 5) - acc) + x) | 0), 0);
};

// (String) => Number
const uuidToRTCID = (uuid) => {
  // The docs say that the limit on the number of channels is 65534,
  // but Chromium barfs if the ID is 1024 or higher --JAB (7/15/19)
  // Oh, you think Chromium's bad?  Firefox only allows 256! --JAB (5/13/21)
  return Math.abs(stringToHash(uuid)) % 256;
};

// (String) => Boolean
const typeIsOOB = (type) => {
  return ["keep-alive", "ping", "ping-result", "pong"].includes(type)
};

// () => UUID
const genUUID = () => {

  const replacer =
    (c) => {
      let r = Math.random() * 16 | 0;
      let v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, replacer);

};

export { genUUID, HNWProtocolVersionNumber, typeIsOOB, uuidToRTCID }

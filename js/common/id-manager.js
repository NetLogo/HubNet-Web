import { MinID, nextID } from "./id.js";

const lastSentIDMap = {}; // Object[String, Number]

// (Number) => Number
const genNextID = (channelID) => {
  const lsid = lastSentIDMap[channelID];
  const next = (lsid !== undefined) ? nextID(lsid) : MinID;
  lastSentIDMap[channelID] = next;
  return next;
};

export { genNextID };

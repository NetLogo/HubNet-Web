const lastSentIDMap = {}; // Object[String, Number]

const SentinelID = 0;
const MinID      = 1;
const MaxID      = Math.pow(2, 32) - 1;

const genNextID = (channelID) => {
  const lsid = lastSentIDMap[channelID];
  const next = (lsid !== undefined) ? nextID(lsid) : MinID;
  lastSentIDMap[channelID] = next;
  return next;
}

const nextID = (num) => {
  return (num === SentinelID) ? SentinelID : ((num === MaxID) ? MinID : num + 1);
};

const prevID = (num) => {
  return (num === SentinelID) ? SentinelID : ((num === MinID) ? MaxID : num - 1);
};

export { genNextID, MaxID, MinID, nextID, prevID, SentinelID }

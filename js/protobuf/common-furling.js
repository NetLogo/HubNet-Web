// type Message = Object[Any]

// (Object[ProtoBufType]) => (Number) => (String, ProtoBufType)
const lookupTypeCode = (typeMap) => (code) => {
  return Object.entries(typeMap)[code];
};

// ((Message) => Message, Object[ProtoBufType]) => (Message) => (Message, ProtoBufType, Number)
const unfurl = (unfurler, typeMap) => (msg) => {

  const unfurled = unfurler(msg);

  const protoType = typeMap[unfurled.type];
  const typeCode  = Object.keys(typeMap).findIndex((x) => x === unfurled.type);

  return [unfurled, protoType, typeCode];

};

export { lookupTypeCode, unfurl }

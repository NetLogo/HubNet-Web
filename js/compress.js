let lastSentIDMap = {}; // Object[String, UUID]

// (Protocol.Channel) => String
const toBaseID = (channel) => channel.url || channel.id;

// (String) => UUID
const extractLastSentID = (channelID) => {
  const lsid = lastSentIDMap[channelID];
  if (lsid !== undefined) {
    return lsid;
  } else {
    const nullary = '00000000-0000-0000-0000-000000000000';
    lastSentIDMap[channelID] = nullary;
    return nullary;
  }
}

// A dummy... for now.  I'll bring in the proper library later. --JAB (7/29/19)
const pako = {
  deflate: ((x) => x)
, inflate: ((x) => x)
};

// (Any) => String
const compress = (data) => {
  return pako.deflate(JSON.stringify(data), { to: 'string' });
};

// (String, Number) => Array[String]
const chunk = (string, length) => {
  const baseArray = Array.from(Array(Math.ceil(string.length / length)));
  return baseArray.map((x, i) => string.substring(length * i, length * (i + 1)));
};

// (String) => Any
const decompress = (deflated) => {
  return JSON.parse(pako.inflate(deflated, { to: 'string' }));
};

// (String) => Array[String]
const chunkForSending = (message) => {

  const chunkSize  = 1200;
  const compressed = compress(message);
  const messages   = chunk(compressed, chunkSize);

  if (messages.length * chunkSize <= 1e7)
    return messages;
  else
    throw new Error('This activity is generating too much data for HubNet Web to reliably transfer.  Aborting....');

};

// (Protocol.Channel) => (String, Any, Boolean, UUID, UUID) => Unit
const _send = (channel) => (type, obj, needsPred = true, predecessorID = extractLastSentID(channel), id = genUUID()) => {

  const clone = Object.assign({}, obj);
  delete clone[id];
  delete clone[predecessorID];

  const finalObj = Object.assign({}, { id }, needsPred ? { predecessorID } : {}, clone);
  channel.send(makeMessage(type, finalObj));

  lastSentIDMap[channel.url] = id;

};

// (Protocol.Channel) => (String, Any) => Unit
const send = (channel) => (type, obj) => {
  _send(channel)(type, obj);
};

// (Protocol.Channel) => (String, Any, Boolean) => Unit
const sendOOB = (channel) => (type, obj) => {
  const fullerObj = Object.assign({}, obj, { isOutOfBand: true });
  channel.send(makeMessage(type, fullerObj));
}

// (Protocol.Channel*) => (String, Any) => Unit
const sendBurst = (...channels) => (type, obj) => {

  const messages = chunkForSending(makeMessage(type, obj));

  const id = genUUID();

  channels.forEach((channel) => {
    messages.forEach(
      (m, index) => {
        const obj = { index, fullLength: messages.length, parcel: m };
        _send(channel)("hnw-burst", obj, index === 0, undefined, id);
      }
    );
  });

};

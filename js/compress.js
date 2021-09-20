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
  return pako.deflate(data, { to: '???' });
};

// (String, Number) => Array[String]
const chunk = (arr, length) => {
  const baseArray = Array.from(Array(Math.ceil(arr.length / length)));
  return baseArray.map((x, i) => arr.slice(length * i, length * (i + 1)));
};

// (String) => Any
const decompress = (deflated) => {
  return pako.inflate(deflated, { to: '???' });
};

// (Array[_]) => Array[Array[U]]
const chunkForSending = (message) => {

  const chunkSize  = 2400;
  const compressed = compress(message);
  const messages   = chunk(compressed, chunkSize);

  if (messages.length * chunkSize <= 2e7)
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

  if (channel instanceof WebSocket) {
    const finalStr = makeMessage(type, finalObj);
    channel.send(finalStr);
  } else {
    const parcel = { type, ...finalObj };
    console.log(`Sending: ${(new Date()).getTime() - 1629910000000} | ${channel.id} | ${type} | ${new TextEncoder().encode(JSON.stringify(parcel)).length / 1024}`);
    console.log(parcel);
    const encoded = window.encodeOutput(parcel);
    channel.send(encoded);
  }

  lastSentIDMap[channel.url] = id;

};

// (Protocol.Channel) => (String, Any) => Unit
const send = (channel) => (type, obj) => {
  _send(channel)(type, obj);
};

// (Protocol.Channel) => (String, Any, Boolean) => Unit
const sendOOB = (channel) => (type, obj) => {
  if (channel instanceof WebSocket) {
    const finalStr = makeMessage(type, obj);
    channel.send(finalStr);
  } else {
    const parcel  = { type, ...obj };
    const encoded = window.encodeOutput(parcel);
    channel.send(encoded);
  }
}

// (Protocol.Channel*) => (String, Any) => Unit
const sendBurst = (...channels) => (type, obj) => {

  const encoded = window.encodeOutput({ type, ...obj });

  const chunks = chunkForSending(encoded);

  const id = genUUID();

  let objs = chunks.map((m, index) => ({ index, fullLength: chunks.length, parcel: m }));

  channels.forEach((channel) => {
    objs.forEach((obj, index) => {
      channels.forEach((channel) => _send(channel)("hnw-burst", obj, index === 0, undefined, id));
    });
  });

};

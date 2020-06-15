// Dummy... for now.  I'll bring in the proper library later. --JAB (7/29/19)
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
const chunkForRTC = (message) => {

  const chunkSize  = 32000;
  const compressed = compress(message);
  const messages   = chunk(compressed, chunkSize);

  if (messages.length <= 99)
    return messages;
  else
    throw new Error('This model is generating too much data for HubNet Web to reliably transfer.  Aborting....');

};

// (RTCDataChannel*) => (String, Any) => Unit
// (WebSocket*) => (String, Any) => Unit
const sendRTCBurst = (...channels) => (type, obj) => {

  const messages = chunkForRTC(makeMessage(type, obj));

  channels.forEach((channel) => {
    const id = (Math.random() * 1e17).toString()
    messages.forEach(
      (m, index) => {
        const obj = { id, index, ts: performance.now(), fullLength: messages.length, parcel: m };
        if (type === "here-have-a-model") {
          console.log("Sending model (" + (index + 1) + "/" + messages.length + ")");
        }
        channel.send(makeMessage("rtc-burst", obj));
      }
    );
  });

};

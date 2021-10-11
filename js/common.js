self.HNWProtocolVersionNumber = "0";

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

// (String, Object[Any]) => Unit
const makeMessage = (type, obj) => {
  return JSON.stringify({ type, ...obj });
}

// (Protocol.StatusBundle) => (Protocol.Channel*) => (String, Object[Any]) => Unit
const sendObj = (statusBundle) => (...channels) => (type, obj) => {
  channels.forEach((channel) => {
    switch (channel.readyState) {
      case statusBundle.connecting:
        setTimeout(() => { sendObj(statusBundle)(channel)(type, obj); }, 50);
        break;
      case statusBundle.closing:
      case statusBundle.closed:
        console.warn(`Cannot send '${type}' message over connection, because it is already closed`, channel, obj);
        break;
      case statusBundle.open:
        if (typeIsOOB(type)) {
          sendOOB(channel)(type, obj);
        } else {
          send(channel)(type, obj);
        }
        break;
      default:
        console.warn(`Unknown connection ready state: ${channel.readyState}`);
    }
  });
};

// (String) => Boolean
const typeIsOOB = (type) => ["keep-alive", "ping", "ping-result", "pong"].includes(type);

// (Protocol.Channel, Protocol.StatusBundle) => Unit
const sendGreeting = (channel, statusBundle) => {
  switch (channel.readyState) {
    case statusBundle.connecting:
      setTimeout(() => { sendGreeting(channel, statusBundle); }, 50);
      break;
    case statusBundle.closing:
    case statusBundle.closed:
      console.warn(`Cannot send 'connect-established' message, because connection is already closed`);
      break;
    case statusBundle.open:
      _send(channel)("connection-established", { protocolVersion: HNWProtocolVersionNumber }, true, '00000000-0000-0000-0000-000000000000');
      break;
    default:
      console.warn(`Unknown connection ready state: ${channel.readyState}`);
  }
};

// (WebSocket*) => (String, Object[Any]) => Unit
const sendWS = sendObj(self.HNWWS.status);

// (RTCDataChannel*) => (String, Object[Any]) => Unit
const sendRTC = sendObj(self.HNWRTC.status);

// () => UUID
const genUUID = () => {

  const replacer =
    (c) => {
      r = Math.random() * 16 | 0;
      v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, replacer);

};

// type Entry = { bytesAdded     :: Number
//              , bufferSnapshot :: Number
//              , channel        :: Protocol.Channel
//              , timestamp      :: Number
//              }

// type Sendable = ArrayBuffer | Blob | String

let entries = []; // Array[Entry]

// (Protocol.Channel) => Number
const getBufferedSize = (channel) => {
  return channel.bufferedAmount;
};

// (Sendable, Protocol.Channel) => Unit
const logEntry = (x, channel) => {

  const bytesAdded =
    (x instanceof Blob)          ? x.size       :
    (x.byteLength !== undefined) ? x.byteLength :
                                   (new TextEncoder().encode(x)).length;

  entries.push({ bytesAdded
               , bufferSnapshot: getBufferedSize(channel)
               , channel
               , timestamp:      performance.now()
               });

};

// () => Number
const reportNewSend = () => {

  const i  = entries.findIndex((e) => e.timestamp >= performance.now() - 1000);
  const es = (i > 0) ? entries.slice(i) : ((i < 0) ? [] : entries);

  const map =
    es.reduce((
      (acc, x) => {
        if (acc.has(x.channel)) {
          acc.get(x.channel).xs.push(x);
          return acc;
        } else {
          const value = { xs: [x] };
          return acc.set(x.channel, value);
        }
      }
    ), new Map());

  const sumBandwidth =
    Array.from(map.values()).reduce((
      (acc, x) => {
        const sum = x.xs.reduce(((a, b) => a + b.bytesAdded), 0);
        return acc + sum;
      }
    ), 0);

  return sumBandwidth;

};

// () => Number
const reportBandwidth = () => {

  const i  = entries.findIndex((e) => e.timestamp >= performance.now() - 1000);
  const es = (i > 0) ? entries.slice(i) : ((i < 0) ? [] : entries);

  const map =
    es.reduce((
      (acc, x) => {
        if (acc.has(x.channel)) {
          acc.get(x.channel).xs.push(x);
          return acc;
        } else {
          const value = { xs:          [x]
                        , startBuffer: x.bufferSnapshot
                        , endBuffer:   getBufferedSize(x.channel)
                        };
          return acc.set(x.channel, value);
        }
      }
    ), new Map());

  const sumBandwidth =
    Array.from(map.values()).reduce((
      (acc, x) => {
        const sum            = x.xs.reduce(((a, b) => a + b.bytesAdded), 0);
        const bufferIncrease = x.endBuffer - x.startBuffer;
        const myBandwidth    = sum - bufferIncrease;
        return acc + myBandwidth;
      }
    ), 0);

  return sumBandwidth;

};

setInterval(() => {
  const i = entries.findIndex((e) => e.timestamp >= performance.now() - 10000);
  entries = (i > 0) ? entries.slice(i) : ((i < 0) ? [] : entries);
}, 10000);

export { logEntry, reportBandwidth, reportNewSend }

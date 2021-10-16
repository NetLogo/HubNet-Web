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
const reportBandwidth = () => {

  const calcBW =
    (acc, x) => {
      const bufferIncrease = getBufferedSize(x.channel) - x.bufferSnapshot;
      const totalDelta     = x.bytesAdded - bufferIncrease;
      return acc + Math.max(0, totalDelta);
    };

  const i = entries.findIndex((e) => e.timestamp >= performance.now() - 1000);
  entries = (i > 0) ? entries.slice(i) : ((i < 0) ? [] : entries);

  const map =
    entries.reduce((
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

export { logEntry, reportBandwidth }

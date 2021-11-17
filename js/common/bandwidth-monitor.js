// type Entry = { bytesAdded     :: Number
//              , bufferSnapshot :: Number
//              , channel        :: Protocol.Channel
//              , timestamp      :: Number
//              }

// type StatBlock = { xs          :: Array[Entry]
//                  , startBuffer :: Number
//                  , endBuffer   :: Number
//                  }

// type Sendable = ArrayBuffer | Blob | String

// (Protocol.Channel) => Number
const getBufferedSize = (channel) => {
  return channel.bufferedAmount;
};

// (StatBlock) => Number
const sumBytesAdded = (sb) => sb.xs.reduce(((a, b) => a + b.bytesAdded), 0);

export default class BandwidthMonitor {

  #entries = undefined; // Array[Entry]

  constructor() {

    this.#entries = [];

    setInterval(() => {
      const es = this.#entries;
      const i  = es.findIndex((e) => e.timestamp >= performance.now() - 10000);
      this.#entries = (i > 0) ? es.slice(i) : ((i < 0) ? [] : es);
    }, 10000);

  }

  // () => Number
  getBandwidth = () => {
    return this.#sumStatsBy(
      (x) => {
        const sum            = sumBytesAdded(x);
        const bufferIncrease = x.endBuffer - x.startBuffer;
        return sum - bufferIncrease;
      }
    , 0);
  };

  // () => Number
  getNewSend = () => {
    return this.#sumStatsBy(sumBytesAdded);
  };

  // (Sendable, Protocol.Channel) => Unit
  log = (x, channel) => {

    const bytesAdded =
      (x instanceof Blob)          ? x.size       :
      (x.byteLength !== undefined) ? x.byteLength :
                                     (new TextEncoder()).encode(x).length;

    this.#entries.push({ bytesAdded
                       , bufferSnapshot: getBufferedSize(channel)
                       , channel
                       , timestamp:      performance.now()
                       });

  };

  // ((StatBlock) => Number) => Number
  #sumStatsBy = (f) => {

    const es    = this.#entries;
    const i     = es.findIndex((e) => e.timestamp >= performance.now() - 1000);
    const newEs = (i > 0) ? es.slice(i) : ((i < 0) ? [] : es);

    const map =
      newEs.reduce((
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

    return Array.from(map.values()).reduce(((acc, x) => acc + f(x)), 0);

  };

}

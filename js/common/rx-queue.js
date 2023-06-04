import { MaxID, MinID, precedesID, prevID, succeedsID } from "/js/common/id.js";
import { typeIsOOB } from "/js/common/util.js";

import { deserialize } from "/js/serialize/xserialize-root.js";

// type MessageHandler = { reset :: () => Unit, run :: (Object[Any]) => Unit }

const dummyID = 0; // Number

export default class RxQueue {

  #decodeInput      = undefined; // (Uint8Array) => Object[Any]
  #isStarted        = undefined; // Boolean
  #lastMsgID        = undefined; // Number
  #messageHandler   = undefined; // MessageHandler
  #multipartHeaders = undefined; // Object[UUID, String]
  #multiparts       = undefined; // Object[UUID, String]
  #predIDToMsg      = undefined; // Object[UUID, Any]

  // (MessageHandler, Boolean) => RxQueue
  constructor(messageHandler, isHost) {
    this.#decodeInput    = deserialize(isHost);
    this.#messageHandler = messageHandler;
    this.reset();
  }

  // (Object[{ data :: ArrayBuffer }]) => Unit
  enqueue = ({ data }) => {

    const decodeInput    = this.#decodeInput;
    const processMessage = this.#messageHandler.run;

    const dataArr = new Uint8Array(data);
    const datum   = decodeInput(dataArr);

    if (typeIsOOB(datum.type)) {
      processMessage(datum);
    } else {
      if (datum.type !== "hnw-burst") {
        this.#preprocess(datum);
      } else if (datum.fullLength === 1) {
        const parcel  = decodeInput(datum.parcel);
        const header  = { type: datum.type, id: datum.id };
        const fullMsg = { ...header, parcel };
        this.#preprocess(fullMsg);
      } else {
        this.#handleFragment(datum);
      }
    }

  };

  // () => Unit
  reset = () => {
    this.#messageHandler.reset();
    this.#isStarted        = false;
    this.#lastMsgID        = dummyID;
    this.#multipartHeaders = {};
    this.#multiparts       = {};
    this.#predIDToMsg      = {};
  };

  // ({ id :: Number, index :: Number, fullLength :: Number
  //  , Parcel :: Object[Any], type :: String }) => Unit
  #handleFragment = ({ id, index, fullLength, parcel, type }) => {

    const decodeInput      = this.#decodeInput;
    const multiparts       = this.#multiparts;
    const multipartHeaders = this.#multipartHeaders;

    if (multiparts[id] === undefined) {
      multiparts[id] = Array(fullLength).fill(null);
    }

    if (index === 0) {
      multipartHeaders[id] = { type, id };
    }

    const bucket = multiparts[id];
    bucket[index] = parcel;

    if (bucket.every((x) => x !== null)) {

      const decoded = decodeInput(assembleBucket(bucket));
      const header  = multipartHeaders[id];
      const fullMsg = { ...header, parcel: decoded };

      delete multiparts[id];
      delete multipartHeaders[id];

      this.#preprocess(fullMsg);

    }

  };

  // (Object[Any]) => Unit
  #preprocess = (msg) => {

    const lastMsgID      = this.#lastMsgID;
    const msgID          = msg.id;
    const predIDToMsg    = this.#predIDToMsg;
    const processMessage = this.#messageHandler.run;

    if (!this.#isStarted && msgID === MinID) {
      this.#isStarted = true;
      this.#lastMsgID = msgID;
      processMessage(msg);
    } else if (succeedsID(msgID, lastMsgID)) {

      // If looping around, clear any junk in the queue --Jason B. (12/2/21)
      if (msgID === MinID && lastMsgID > MinID) {
        const newQueue = {};
        if (precedesID(lastMsgID, MaxID) || lastMsgID === MaxID) {
          for (let i = lastMsgID; i <= MaxID; i++) {
            if (predIDToMsg[i] !== undefined) {
              newQueue[i] = predIDToMsg[i];
            }
          }
        }
        this.#predIDToMsg = newQueue;
      }

      this.#predIDToMsg[prevID(msgID)] = msg;
      this.#processQueue();

    } else {
      const s = `Received message #${msgID} when the last-processed message was #${lastMsgID}.  #${msgID} is out-of-order and will be dropped:`;
      console.warn(s, msg);
    }

  };

  // () => Unit
  #processQueue = () => {

    const lastMsgID      = this.#lastMsgID;
    const predIDToMsg    = this.#predIDToMsg;
    const processMessage = this.#messageHandler.run;
    const recurse        = this.#processQueue;

    const successor = predIDToMsg[lastMsgID];
    if (successor !== undefined) {
      delete predIDToMsg[lastMsgID];
      this.#lastMsgID = successor.id;
      processMessage(successor);
      recurse();
    }

  };

}

// (Array[Uint8Array]) => Uint8Array
const assembleBucket = (bucket) => {

  const totalLength = bucket.reduce((acc, x) => acc + x.length, 0);
  const arr         = new Uint8Array(totalLength);

  bucket.reduce(
    (acc, x) => {
      arr.set(x, acc);
      return acc + x.length;
    }
  , 0);

  return arr;

};

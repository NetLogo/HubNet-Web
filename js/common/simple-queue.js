import { MaxID, MinID, precedesID, prevID, succeedsID } from "/js/common/id.js";

// type MessageHandler = (Object[Any]) => Unit

const dummyID = -2; // Number

export default class SimpleQueue {

  #handleMessage = undefined; // MessageHandler
  #isStarted     = undefined; // Boolean
  #lastMsgID     = undefined; // Number
  #predIDToMsg   = undefined; // Object[UUID, Any]

  // (MessageHandler) => MessageQueue
  constructor(handleMessage) {
    this.#handleMessage = handleMessage;
    this.#isStarted     = false;
    this.#lastMsgID     = dummyID;
    this.#predIDToMsg   = {};
  }

  // (Object[Any]) => Unit
  enqueue = (msg) => {

    const lastMsgID   = this.#lastMsgID;
    const msgID       = msg.id;
    const predIDToMsg = this.#predIDToMsg;

    if (!this.#isStarted && msgID === MinID) {
      this.#isStarted = true;
      this.#lastMsgID = msgID;
      this.#handleMessage(msg);
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

    const lastMsgID   = this.#lastMsgID;
    const predIDToMsg = this.#predIDToMsg;

    const successor = predIDToMsg[lastMsgID];

    if (successor !== undefined) {
      delete predIDToMsg[lastMsgID];
      this.#lastMsgID = successor.id;
      this.#handleMessage(successor);
      this.#processQueue();
    }

  };

}

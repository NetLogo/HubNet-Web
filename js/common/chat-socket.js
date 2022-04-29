import { awaitWorker } from "./await.js";
import genWorker       from "/js/common/worker.js";

export default class ChatSocket {

  #worker = undefined; // Worker[ChatSocketWorker]

  // (ChatManager) => ChatSocket
  constructor(chatManager) {

    this.#worker = genWorker("js/common/chat-socket-worker.js");

    this.#worker.onmessage = ({ data }) => {
      const datum = JSON.parse(data);
      switch (datum.type) {
        case "census": {
          chatManager.addNewChat(`${datum.num} client(s) connected.`, "(Census)");
          break;
        }
        case "chat": {
          const { isAuthority, message, sender } = datum;
          chatManager.addNewChat(message, sender, false, isAuthority);
          break;
        }
        default: {
          console.warn("Unknown chat socket message type:", datum.type);
        }
      }
    };

    const send = (type, obj = {}) => {
      this.#worker.postMessage({ type, ...obj });
    };

    chatManager.onSend((message) => send("send", { message }));

  }

  // (String) => Promise[_]
  "await" = (msg) => {
    return awaitWorker(this.#worker)(msg);
  };

}

export default class ChatManager {

  #lastTS             = undefined; // Number
  #markChatRead       = undefined; // () => Unit
  #markChatUnread     = undefined; // () => Unit
  #outputElem         = undefined; // Element
  #sendInput          = undefined; // (String) => Unit
  #unreadMessageCount = undefined; // Number

  // (Element, Element, () => Unit, () => Unit, () => Unit, () => Unit) => ChatManager
  constructor( outputElem, inputElem, notifyTooWordy, notifyTooFast
             , markChatUnread = () => {}, markChatRead = () => {}) {

    this.#lastTS             = 0;
    this.#markChatRead       = markChatRead;
    this.#markChatUnread     = markChatUnread;
    this.#outputElem         = outputElem;
    this.#unreadMessageCount = 0;
    this.#sendInput          = () => {
      console.warn("Chat manager asked to send without a callback", outputElem);
    };

    inputElem.addEventListener("keydown", (e) => {

      if (e.code === "Enter") {

        const input           = inputElem.value.trim();
        const oncePer15Frames = 15 * 1000 / 60;

        if (input.length >= 4000) {
          notifyTooWordy();
        } else if ((Date.now() - this.#lastTS) <= oncePer15Frames) {
          notifyTooFast();
        } else {
          if (input.length > 0) {
            this.#sendInput(input);
            this.addNewChat(input, "Me", true);
            this.#lastTS    = Date.now();
            inputElem.value = "";
          }
        }

      }

    });

  }

  // (String, String, Boolean?, Boolean?) => Unit
  addNewChat = (str, from, isFromSelf = false, isFromAuthority = false) => {

    const elem = this.#outputElem;

    const entry = document.createElement("div");
    entry.classList.add("chat-entry");

    if (from === "" || isFromAuthority) {
      entry.classList.add("chat-from-host");
    }

    if (isFromSelf) {
      entry.classList.add("chat-from-self");
    }

    const fromCensus = from === "(Census)";

    const openBox = elem.closest("#chat-box-open");

    if (!fromCensus) {
      const onJoinPage = openBox !== null;
      if (onJoinPage) {
        const chatOpen           = !openBox.classList.contains("invisible");
        this.#unreadMessageCount = chatOpen ? 0 : (this.#unreadMessageCount + 1);
      }
    }

    const realFrom = isFromSelf ? "Me" : ((from !== "") ? from : "(Host)");
    const span     = document.createElement("span");
    span.classList.add("chat-from");
    span.innerText = `${realFrom}> `;

    const chat = document.createElement("span");
    chat.classList.add("chat-text");
    chat.innerText = str;

    entry.appendChild(span);
    entry.appendChild(chat);

    elem.appendChild(entry);

    elem.scrollTo(0, elem.scrollHeight);

    if (this.hasUnreadMessages()) {
      this.#markChatUnread();
    } else {
      this.#markChatRead();
    }

  };

  // () => Unit
  clear = () => {
    this.#outputElem.innerHTML = "";
  };

  // () => Number
  getUnreadMessages = () => {
    return this.#unreadMessageCount;
  };

  // () => Boolean
  hasUnreadMessages = () => {
    return this.#unreadMessageCount !== 0;
  };

  // () => Unit
  markAllMessagesRead = () => {
    this.#unreadMessageCount = 0;
    this.#markChatRead();
  };

  // ((String) => Unit) => Unit
  onSend = (callback) => {
    this.#sendInput = callback;
  };

}

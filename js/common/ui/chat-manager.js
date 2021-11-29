export default class ChatManager {

  #lastTS     = undefined; // Number
  #outputElem = undefined; // Element

  // (Element, Element, (String) => Unit, () => Unit, () => Unit) => ChatManager
  constructor(outputElem, inputElem, sendInput, notifyTooWordy, notifyTooFast) {

    this.#lastTS     = 0;
    this.#outputElem = outputElem;

    inputElem.addEventListener("keydown", (e) => {
      if (e.code === "Enter") {
        const input           = inputElem.value.trim();
        const oncePer15Frames = 15 * 1000 / 60;
        if (input.length >= 4000) {
          notifyTooWordy();
        } else if ((Date.now() - this.#lastTS) <= oncePer15Frames) {
          notifyTooFast();
        } else {
          sendInput(input);
          this.addNewChat(input, "Me", true);
          this.#lastTS = Date.now();
          inputElem.value = "";
        }
      }
    });

  }

  // (String, String, Boolean) => Unit
  addNewChat = (str, from, isFromSelf = false) => {

    const elem = this.#outputElem;

    const entry = document.createElement("div");
    entry.classList.add("chat-entry");

    if (from === "") {
      entry.classList.add("chat-from-host");
    }

    if (isFromSelf) {
      entry.classList.add("chat-from-self");
    }

    const realFrom = isFromSelf ? "Me" : ((from !== "") ? from : "(Host)");
    const span = document.createElement("span");
    span.classList.add("chat-from");
    span.innerText = `${realFrom}> `;

    const chat = document.createElement("span");
    chat.classList.add("chat-text");
    chat.innerText = str;

    entry.appendChild(span);
    entry.appendChild(chat);

    elem.appendChild(entry);

    elem.scrollTo(0, elem.scrollHeight);

  };

}
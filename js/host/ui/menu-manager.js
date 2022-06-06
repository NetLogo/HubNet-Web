// type Elem = HTMLElement

// Array[String]
const containerTypes =
  ["command-center", "model-code", "model-info", "session-chat", "global-chat"];

// Object[String]
const containerToMenuID =
  Object.fromEntries(
    containerTypes.map((t) => [`${t}-container`, `${t}-select`])
  );

// Object[Number]
const idToWidth =
  { "command-center-container": 400
  , "model-code-container":     600
  , "model-info-container":     400
  , "session-chat-container":   350
  , "global-chat-container":    350
  };

export default class MenuManager {

  #maxWidth = undefined; // Number
  #menuElem = undefined; // Elem

  // (Elem, Number) => MenuManager
  constructor(menuElem, maxWidth) {

    this.#maxWidth = maxWidth;
    this.#menuElem = menuElem;

    if (maxWidth < Math.max(...Object.values(idToWidth))) {
      menuElem.classList.add("invisible");
    }

    containerTypes.map((t) => menuElem.querySelector(`#${t}-header`)).forEach(
      (header) => {
        header.onclick = () => {
          this.#closeContainer(header.parentNode.id);
        };
      }
    );

    setUpDrawer(menuElem);

    this.#setUpOptions();

  }

  // (Number) => Unit
  registerResize = (newWidth) => {

    this.#maxWidth = newWidth;

    const maxPossibleWidth = Math.max(...Object.values(idToWidth));

    if (newWidth < maxPossibleWidth) {
      this.#menuElem.classList.add("invisible");
    } else {
      this.#menuElem.classList.remove("invisible");
    }

    while (this.#willBeTooWide(0)) {
      this.#closeContainer(this.#getOpenContainers().at(-1).id);
    }

  };

  // (String) => Unit
  #closeContainer = (id) => {

    const opens     = this.#getOpenContainers();
    const container = opens.find((c) => c.id === id);

    if (container !== undefined) {
      delete container.dataset.timestamp;
      container.classList.add("invisible");
      container.style.transform   = null;
      container.style.marginRight = null;
      this.#layoutElements();
    }

    const menuID   = containerToMenuID[id];
    const menuItem = this.#menuElem.querySelector(`#${menuID}`);
    menuItem.classList.remove("active");

  };

  // () => Array[Elem]
  #getOpenContainers = () => {

    const checkIsOpen =
      (container) => !Array.from(container.classList).includes("invisible");

    const toInt = (container) => parseInt(container.dataset.timestamp);

    const all = Array.from(this.#menuElem.querySelectorAll(".menu-option-container"));
    return all.filter(checkIsOpen).sort((x, y) => toInt(y) - toInt(x));

  };

  // () => Unit
  #setUpOptions = () => {
    this.#menuElem.querySelectorAll(".drawer-text-container").forEach(
      (option) => {
        option.onclick = () => {
          const opens = this.#getOpenContainers();
          const id    = `${option.dataset.type}-container`;
          const index = opens.findIndex((c) => c.id === id);
          if (index !== -1) {
            this.#closeContainer(id);
          } else {
            this.#openContainer(id);
          }
        };
      }
    );
  };

  // (Array[Elem]) => Unit
  #layoutElements = () => {

    let offsetPx = 0;

    this.#getOpenContainers().reverse().forEach(
      (elem, index) => {

        const isFirst = index === 0;
        elem.style.marginRight = isFirst ? null : "3px";
        elem.style.transform   = isFirst ? null : `translateX(-${offsetPx}px)`;

        const margin = isFirst ? 0 : 3;
        offsetPx += idToWidth[elem.id] + margin;

      }
    );

  };

  // (String) => Unit
  #openContainer = (id) => {

    const newGuyWidth = idToWidth[id];

    while (this.#willBeTooWide(newGuyWidth)) {
      this.#closeContainer(this.#getOpenContainers().at(-1).id);
    }

    const elem = this.#menuElem.querySelector(`#${id}`);

    const menuID   = containerToMenuID[`${id}`];
    const menuItem = this.#menuElem.querySelector(`#${menuID}`);
    menuItem.classList.add("active");

    elem.dataset.timestamp = Date.now();
    elem.style.width       = `${newGuyWidth}px`;
    elem.classList.remove("invisible");

    this.#layoutElements();

  };

  // (Number) => Boolean
  #willBeTooWide = (newGuyWidth) => {
    const opens    = this.#getOpenContainers();
    const newWidth = calculateBreadth(opens) + newGuyWidth;
    const margins  = 3 * (opens.length - 1);
    return newWidth + margins >= this.#maxWidth;
  };

}

// (Elem) => Unit
const setUpDrawer = (menuElem) => {

  const closed = menuElem.querySelector("#drawer-closed");
  const open   = menuElem.querySelector("#drawer-open");
  const pin    = menuElem.querySelector("#menu-pin-container");

  const checkIsPinned = () => {
    return pin.classList.contains("active");
  };

  closed.onmouseover = () => {
    if (!checkIsPinned()) {
      closed.classList.add   ("invisible");
      open  .classList.remove("invisible");
    }
  };

  open.onmouseleave = () => {
    if (!checkIsPinned()) {
      closed.classList.remove("invisible");
      open  .classList.add   ("invisible");
    }
  };

  pin.onclick = () => {
    if (checkIsPinned()) {
      pin.classList.remove("active");
    } else {
      pin.classList.add("active");
    }
  };

};

// (Array[HTMLElement]) => Number
const calculateBreadth = (elems) => {
  const f = (acc, x) => acc + parseInt(x.style.width.replace(/px$/, ""));
  return elems.reduce(f, 0);
};

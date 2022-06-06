// type Button = HTMLButtonElement
// type Elem   = HTMLElement

export default class ModalManager {

  #checkIsOnHostA = undefined; // () => Boolean
  #descElem       = undefined; // Elem
  #detailsElem    = undefined; // Elem
  #statsElem      = undefined; // Elem

  // (() => Boolean, Elem, Elem, Elem, Button, Button, Button, Button) => ModalManager
  constructor( checkIsOnHostA, descElem, detailsElem, statsElem
             , openStatsButton, closeStatsButton, openDescButton, closeDescButton) {

    this.#checkIsOnHostA = checkIsOnHostA;
    this.#descElem       = descElem;
    this.#detailsElem    = detailsElem;
    this.#statsElem      = statsElem;

    openStatsButton.onclick = () => {
      this.#detailsElem.classList.remove("modal-invis");
      this.#statsElem.classList.remove("modal-invis", "no-display");
    };

    closeStatsButton.onclick = () => {
      this.#detailsElem.classList.add("modal-invis");
      hide(this.#statsElem);
    };

    openDescButton.onclick = () => {
      this.#descElem.classList.remove("modal-invis");
    };

    closeDescButton.onclick = () => {
      this.#descElem.classList.add("modal-invis");
    };

  }

  // (MouseEvent) => Unit
  onDocumentClick = (event) => {
    if (this.#checkIsOnHostA()) {
      if (event.target === this.#descElem) {
        this.#descElem.classList.add("modal-invis");
      }
    } else {
      if (event.target === this.#detailsElem) {
        hide(this.#statsElem);
        this.#detailsElem.classList.add("modal-invis");
      }
    }
  };

  // (KeyboardEvent) => Unit
  onKeydown = (event) => {
    if (event.key === "Escape") {
      if (this.#checkIsOnHostA()) {
        this.#descElem.classList.add("modal-invis");
      } else {
        hide(this.#statsElem);
        this.#detailsElem.classList.add("modal-invis");
      }
    }
  };

}

// (Elem) => Unit
const hide = (elem) => {
  elem.classList.add("modal-invis", "no-display");
};

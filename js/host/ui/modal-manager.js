// type Button = HTMLButtonElement
// type Elem   = HTMLElement

export default class ModalManager {

  #checkIsOnHostA = undefined; // () => Boolean
  #descElem       = undefined; // Elem
  #detailsElem    = undefined; // Elem

  // (() => Boolean, Elem, Elem, Button, Button, Button, Button) => ModalManager
  constructor( checkIsOnHostA, descElem, detailsElem, openStatsButton
             , closeStatsButton, openDescButton, closeDescButton) {

    this.#checkIsOnHostA = checkIsOnHostA;
    this.#descElem       = descElem;
    this.#detailsElem    = detailsElem;

    openStatsButton.onclick = () => {
      this.#detailsElem.classList.remove("modal-invis");
    };

    closeStatsButton.onclick = () => {
      this.#detailsElem.classList.add("modal-invis");
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
        this.#detailsElem.classList.add("modal-invis");
      }
    }
  };

}

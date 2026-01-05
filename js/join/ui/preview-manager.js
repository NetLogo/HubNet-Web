const imagePlaceholder = "/assets/images/hubnet-web-icon.svg";

export default class PreviewManager {

  #elem = undefined; // Element

  // (Element) => PreviewManager
  constructor(elem) {
    this.#elem = elem;
  }

  // (UUID) => Unit
  fetch = (oracleID) => {
    fetch(`/preview/${oracleID}`).then((response) => {
      if (response.ok) {
        response.text().then(this.#setImage);
      } else {
        this.useDefault();
      }
    }).catch(this.useDefault);
  };

  // () => UNit
  useDefault = () => {
    this.#setImage(imagePlaceholder);
    this.#elem.classList.add("session-preview-image-default")
  };

  // (String) => Unit
  #setImage = (src) => {
    this.#elem.classList.remove("session-preview-image-default")
    this.#elem.src = src;
  };

}

const imagePlaceholder = "/assets/images/netlogo-icon.png";

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
  };

  // (String) => Unit
  #setImage = (src) => {
    this.#elem.src = src;
  };

}

const placeholderBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4wYGEwkDoISeKgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAADElEQVQI12NobmwEAAMQAYa2CjzCAAAAAElFTkSuQmCC";

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
    this.#setImage(placeholderBase64);
  };

  // (String) => Unit
  #setImage = (src) => {
    this.#elem.src = src;
  };

}

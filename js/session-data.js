// type Session = { modelName :: String, name :: String, oracleID :: UUID }

export default class SessionData {

  #data = null; // Array[Session]

  // () => SessionData
  constructor() {
  }

  // () => Array[Session]
  get = () => {
    return this.#get().slice(0);
  };

  // (UUID) => Session?
  lookup = (id) => {
    return this.#get().find((s) => s.oracleID === id);
  };

  // (Array[Session]) => Unit
  set = (newData) => {
    this.#data = newData;
  };

  // () => Number
  size = () => {
    return this.#get().length;
  };

  // () => Array[Session]
  #get = () => {
    return (this.#data !== null) ? this.#data : [];
  };

}

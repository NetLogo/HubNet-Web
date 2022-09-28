// type Session = { modelName :: String, name :: String, oracleID :: UUID
//                , roleInfo  :: Array[(String, Number, Number)] }

export default class SessionData {

  #data   = null;      // Array[Session]
  #filter = undefined; // (Session) => Boolean

  // () => SessionData
  constructor() {
  }

  // ((Session) => Boolean) => Unit
  applyFilter = (f) => {
    this.#filter = f;
  };

  // () => Unit
  clearFilter = () => {
    this.#filter = () => true;
  };

  // () => Array[Session]
  get = () => {
    return this.#get().slice(0);
  };

  // () => Boolean
  hasBeenInitialized = () => {
    return this.#data !== null;
  };

  // () => Boolean
  isEmpty = () => {
    return this.size() === 0;
  };

  // () => Boolean
  isEmptyUnfiltered = () => {
    return this.#getUnfiltered().length === 0;
  };

  // (UUID) => Session?
  lookup = (id) => {
    return this.#get().find((s) => s.oracleID === id);
  };

  // (UUID) => Session?
  lookupUnfiltered = (id) => {
    return this.#getUnfiltered().find((s) => s.oracleID === id);
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
    return (this.#data !== null) ? this.#data.filter(this.#filter) : [];
  };

  // () => Array[Session]
  #getUnfiltered = () => {
    return (this.#data !== null) ? this.#data : [];
  };

}

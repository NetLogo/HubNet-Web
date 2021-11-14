export default class AppStatusManager {

  #elem = undefined; // Element

  // (Element) => AppStatusManager
  constructor(elem) {
    this.#elem = elem;
  }

  // () => Unit
  allSessionsHidden = () => {
    this.#setStatus("Session list received.  There are some sessions available, but they are hidden by your search filter.");
  };

  // () => Unit
  awaitingNewSessions = () => {
    this.#setStatus("Please wait until someone starts a session, and it will appear in the list below.");
  };

  // () => Unit
  awaitingSelection = () => {
    this.#setStatus("Session list received.  Please select a session.");
  };

  // () => Unit
  closedFromError = () => {
    this.#setStatus("We encountered an error and your session had to be closed.");
  };

  // () => Unit
  connecting = () => {
    this.#setStatus("Attempting to connect...");
  };

  // () => Unit
  downloadingModel = () => {
    this.#setStatus("Downloading model from host...");
  };

  // () => Unit
  enterLoginInfo = () => {
    this.#setStatus("Session selected.  Please enter a username, enter a password (if needed), and click 'Join'.");
  };

  // () => Unit
  failedToLoadModel = () => {
    this.#setStatus("NetLogo Web failed to load the host's model.");
  };

  // () => Unit
  iceConnectionLost = () => {
    this.#setStatus("Connection lost to host.");
  };

  // () => Unit
  loadingNLW = () => {
    this.#setStatus("Logged in!  Loading NetLogo and then asking for model....");
  };

  // () => Unit
  loadingNLWUI = () => {
    this.#setStatus("Loading up interface in NetLogo Web...");
  };

  // () => Unit
  loggingIn = () => {
    this.#setStatus("Connected!  Attempting to log in....");
  };

  // () => Unit
  modelLoaded = () => {
    this.#setStatus("Model loaded and ready for you to use!");
  };

  // () => Unit
  rejectedOverPassword = () => {
    this.#setStatus("Login rejected!  Use correct password.");
  };

  // () => Unit
  rejectedOverBlankName = () => {
    this.#setStatus("Login rejected!  Please provide a username.");
  };

  // () => Unit
  rejectedOverDupeName = () => {
    this.#setStatus("Login rejected!  Choose a unique username.");
  };

  // () => Unit
  waitingForNLWBoot = () => {
    this.#setStatus("Model and world acquired!  Waiting for NetLogo Web to be ready...");
  };

  // (String) => Unit
  #setStatus = (statusText) => {
    this.#elem.innerText = statusText;
  };

}

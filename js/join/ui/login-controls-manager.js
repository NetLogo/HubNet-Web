export default class LoginControlsManager {

  #button          = undefined; // HTMLButtonElement
  #lastUUID        = null;      // UUID
  #nlwFrameDataset = undefined; // HTMLElementDataset
  #passwordInput   = undefined; // HTMLInputElement
  #roleSelect      = undefined; // HTMLSelectElement
  #usernameInput   = undefined; // HTMLInputElement

  // (Element, HTMLElementDataset, (String, String) => Unit) => LoginControlsManager
  constructor(joinForm, nlwFrameDataset, onLogIn) {

    this.#button        = joinForm.querySelector("#join-button");
    this.#usernameInput = joinForm.querySelector("#username"   );
    this.#passwordInput = joinForm.querySelector("#password"   );
    this.#roleSelect    = joinForm.querySelector("#role-select");
    this.#nlwFrameDataset = nlwFrameDataset;

    joinForm.addEventListener("submit", () => {

      this.#button.disabled = true;

      const username     = this. getUsername();
      const password     = this.#getPassword();
      const sessionName  = this.getSessionName();
      const activityName = this.getActivityName();

      onLogIn(username, password, sessionName, activityName);

    });

  }

  // () => String
  getUsername = () => {
    return this.#usernameInput.value;
  };

  // () => Unit
  join = () => {
    this.#button.click();
  };

  // (() => HTMLOptionElement) => (Session) => Unit
  onNewSelection = (createOption) => (session) => {

    const hasActive = session !== null;

    const isNewSelection = session?.oracleID !== this.#lastUUID;
    this.#lastUUID       = session?.oracleID;

    this.#passwordInput.disabled = !hasActive || !session.hasPassword;
    this.#button       .disabled = !hasActive;
    this.#roleSelect   .disabled = !hasActive;

    if (!this.#passwordInput.disabled) {
      this.#passwordInput.classList.remove("disabled");
    }

    if (!this.#button.disabled) {
      this.#button.classList.remove("disabled");
    }

    if (!this.#roleSelect.disabled) {
      this.#roleSelect.classList.remove("disabled");
    }

    this.#nlwFrameDataset. sessionName = session === null ? "" : session.name;
    this.#nlwFrameDataset.activityName = session === null ? "" : session.modelName;

    if (!hasActive || isNewSelection) {
      this.setPassword("");
    }

    this.#roleSelect.innerHTML = "";

    if (hasActive) {
      session.roleInfo.forEach(
        ([roleName, current, max]) => {
          const node        = createOption();
          const isUnlimited = max === 0;
          node.disabled     = !isUnlimited && current >= max;
          node.innerText    = isUnlimited ? `${roleName} (${current})` :
                                            `${roleName} (${current}/${max})`;
          node.value        = roleName;
          this.#roleSelect.appendChild(node);
        }
      );
    }

  };

  // () => Unit
  reset = () => {
    this.#button.disabled = false;
    this.#button.classList.remove("disabled");
  };

  // (String) => Unit
  setUsername = (username) => {
    this.#usernameInput.value = username;
  };

  // (String) => Unit
  setPassword = (password) => {
    this.#passwordInput.value = password;
  };

  // () => String
  #getPassword = () => {
    return this.#passwordInput.value;
  };

  // () => String
  getSessionName = () => {
    return this.#nlwFrameDataset.sessionName;
  };

  // () => String
  getActivityName = () => {
    return this.#nlwFrameDataset.activityName;
  };

}

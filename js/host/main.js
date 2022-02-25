import ConnectionManager from "./conn/connection-manager.js";

import BandwidthManager     from "./ui/bandwidth-manager.js";
import LaunchControlManager from "./ui/launch-control-manager.js";
import NLWManager           from "./ui/nlw-manager.js";

import ChatManager from "/js/common/ui/chat-manager.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

// (String) => Unit
const onNLWManError = (subtype) => {
  alert(`Fatal error received from client: ${subtype}`);
  self.location.reload();
};

// (Object[Any]) => Unit
const finishLaunch = ({ isSuccess, data }) => {

  if (isSuccess) {

    const { hostID, json, nlogo } = data;

    document.getElementById("id-display").innerText = hostID;

    history.pushState({ name: "hosting" }, "hosting");

    nlwManager.show();
    nlwManager.becomeOracle(hostID, json, nlogo);

    connMan.connect(hostID);

    setInterval(() => {
      const amounts = connMan.getBufferedAmounts();
      bandwidthManager.updateCongestionStats(amounts);
    }, 1000);

    setInterval(() => {
      const bandwidth = connMan.getBandwidth();
      const newSend   = connMan.getNewSend();
      bandwidthManager.updateBandwidth(connMan.awaitBandwidthReport(), bandwidth);
      bandwidthManager.updateNewSend  (connMan.awaitNewSendReport()  , newSend  );
    }, 500);

    setInterval(() => {
      nlwManager.awaitPreview().
        then(({ blob }) => { connMan.postImageUpdate(blob); });
    }, 8000);

  }

};

// (Object[Any]) => Unit
const launchModel = (model) => {
  launchControlManager.launch(model).then(finishLaunch);
};

const awaitLaunchHTTP = (data) => fetch("/launch-session", data);
const notifyUser      = (s) => { alert(s); };

// (String) => (String) => Unit
const setIT = (id) => (text) => {
  byEID(id).innerText = text;
};

// () => Number
const getCapacity = () => {
  return Math.max(0, Math.min(999, parseInt(byEID("max-num-clients-picker").value)));
};

const launchControlManager =
  new LaunchControlManager( byEID("form-frame"), awaitLaunchHTTP, notifyUser
                          , finishLaunch);

const sessionChatManager =
  new ChatManager( byEID("session-chat-output"), byEID("session-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); });

const globalChatManager =
  new ChatManager( byEID("global-chat-output"), byEID("global-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); });

const connMan =
  new ConnectionManager( sessionChatManager, globalChatManager
                       , (jid, un)   =>   nlwManager.awaitJoinerInit(jid, un)
                       , (jid, ping) => { nlwManager.registerPingStats(jid, ping); }
                       , (pl)        => { nlwManager.relay(pl);                    }
                       , (jid)       => { nlwManager.disown(jid);                  }
                       , (cs)        => { bandwidthManager.updateTURNs(cs);        }
                       , launchControlManager.passwordMatches, getCapacity()
                       , notifyUser);

const nlwManager =
  new NLWManager( byEID("nlw-frame"), connMan.broadcast
                , connMan.narrowcast, onNLWManError);

document.addEventListener("DOMContentLoaded", () => {

  // (NEW): TODO
  document.onclick = (event) => {
    const onHostAPage = byEID("nlw-frame").classList.contains("hidden");

    if (onHostAPage) {
      if (event.target === descriptionModalContainer) {
        descriptionModalContainer.classList.add("modal-invis");
      }
    } else {
      if (event.target === statsModalContainer) {
        hideModal(statsModalContainer);
      } else if (event.target === codeModalContainer) {
        hideModal(codeModalContainer);
      } else if (event.target === modelInfoModalContainer) {
        hideModal(modelInfoModalContainer);
      }
    }
  };

  document.addEventListener("keydown", (event) => {
    const onHostAPage = byEID("nlw-frame").classList.contains("hidden");

    if (onHostAPage) {
      if (!descriptionModalContainer.classList.contains("modal-invis") && event.key === "Escape") {
        descriptionModalContainer.classList.add("modal-invis");
      }
    } else {
      if (event.key === "Escape") {
        hideAllHostBModals();
      }
    }
  });

  // (NEW): TODO
  const descriptionModalContainer = byEID("description-modal-container");

  byEID("read-more-button").onclick = () => {
    descriptionModalContainer.classList.remove("modal-invis");
  };

  byEID("close-description-modal-button").onclick = () => {
    descriptionModalContainer.classList.add("modal-invis");
  };

  // (NEW): TODO
  const capacityDisplayText = document.getElementById("capacity-display-text");
  const capacitySlider = document.getElementById("max-num-clients-picker");

  capacitySlider.onchange = (e) => {
    capacityDisplayText.innerHTML = `Session Capacity: ${e.target.value}`;
  };

  const sessionClosedChatBox = document.getElementById("session-chat-box-closed");
  const sessionClosedChatBoxBottom = document.getElementById("session-chat-box-closed-bottom");
  const sessionOpenChatBox = document.getElementById("session-chat-box-open");
  const sessionOpenChatHeader = document.getElementById("session-open-chat-header");

  sessionClosedChatBox.onclick = () => {
    sessionOpenChatBox.classList.remove("invisible");
    sessionClosedChatBox.classList.add("invisible");
    sessionClosedChatBoxBottom.classList.add("invisible");
  };

  sessionOpenChatHeader.onclick = () => {
    sessionOpenChatBox.classList.add("invisible");
    sessionClosedChatBox.classList.remove("invisible");
    sessionClosedChatBoxBottom.classList.remove("invisible");
  };

  const globalClosedChatBox = document.getElementById("global-chat-box-closed");
  const globalClosedChatBoxBottom = document.getElementById("global-chat-box-closed-bottom");
  const globalOpenChatBox = document.getElementById("global-chat-box-open");
  const globalOpenChatHeader = document.getElementById("global-open-chat-header");

  globalClosedChatBox.onclick = () => {
    globalOpenChatBox.classList.remove("invisible");
    globalClosedChatBox.classList.add("invisible");
    globalClosedChatBoxBottom.classList.add("invisible");
  };

  globalOpenChatHeader.onclick = () => {
    globalOpenChatBox.classList.add("invisible");
    globalClosedChatBox.classList.remove("invisible");
    globalClosedChatBoxBottom.classList.remove("invisible");
  };

  const commandCenterClosedBox = document.getElementById("command-center-closed");
  const commandCenterOpenBox = document.getElementById("command-center-open");
  const commandCenterOpenHeader = document.getElementById("command-center-header");

  commandCenterClosedBox.onclick = () => {
    commandCenterOpenBox.classList.remove("invisible");
    commandCenterClosedBox.classList.add("invisible");
  };

  commandCenterOpenHeader.onclick = () => {
    commandCenterOpenBox.classList.add("invisible");
    commandCenterClosedBox.classList.remove("invisible");
  };

  // (NEW): TODO
  const statsModalTab = document.getElementById("stats-modal-tab");
  const codeModalTab = document.getElementById("code-modal-tab");
  const modelInfoModalTab = document.getElementById("model-info-modal-tab");

  const closeStatsModalButton = document.getElementById("close-stats-modal-button");
  const closeCodeModalButton = document.getElementById("close-code-modal-button");
  const closeModelInfoModalButton = document.getElementById("close-model-info-modal-button");

  const statsModalContainer = document.getElementById("stats-modal-container");
  const codeModalContainer = document.getElementById("code-modal-container");
  const modelInfoModalContainer = document.getElementById("model-info-modal-container");
  const hostBPageMain = document.getElementById("nlw-frame");

  const showModal = (modalContainer) => {
    modalContainer.classList.remove("modal-invis");
    hostBPageMain.classList.add("no-select");
  };

  const hideModal = (modalContainer) => {
    modalContainer.classList.add("modal-invis");
    hostBPageMain.classList.remove("no-select");
  };

  const hideAllHostBModals = () => {
    const statsModalIsInvis = statsModalContainer.classList.contains("modal-invis");
    const codeModalIsInvis = codeModalContainer.classList.contains("modal-invis");
    const modelInfoModalIsInvis = modelInfoModalContainer.classList.contains("modal-invis");

    if (!statsModalIsInvis) {
      hideModal(statsModalContainer);
    } else if (!codeModalIsInvis) {
      hideModal(codeModalContainer);
    } else if (!modelInfoModalIsInvis) {
      hideModal(modelInfoModalContainer);
    }
  };

  statsModalTab.onclick = () => {
    hideAllHostBModals();
    showModal(statsModalContainer);
  };

  codeModalTab.onclick = () => {
    hideAllHostBModals();
    showModal(codeModalContainer);
  };

  modelInfoModalTab.onclick = () => {
    hideAllHostBModals();
    showModal(modelInfoModalContainer);
  };

  closeStatsModalButton.onclick = () => {
    hideModal(statsModalContainer);
  };

  closeCodeModalButton.onclick = () => {
    hideModal(codeModalContainer);
  };

  closeModelInfoModalButton.onclick = () => {
    hideModal(modelInfoModalContainer);
  };

  nlwManager.init();
});

const bandwidthManager =
    new BandwidthManager( setIT("bandwidth-span"), setIT("new-send-span")
                        , setIT("num-clients-span"), setIT("num-congested-span")
                        , setIT("activity-status-span"), setIT("num-turn-span")
                        , nlwManager.notifyCongested, nlwManager.notifyUncongested);

byEID("max-num-clients-picker").addEventListener("change", () => {
  connMan.updateFullness(getCapacity());
});

window.addEventListener("message", ({ data }) => {
  switch (data.type) {
    case "galapagos-direct-launch": {
      const { nlogo, config, sessionName, password } = data;
      launchModel({ modelType:  "upload"
                  , model:       nlogo
                  , sessionName
                  , password
                  , config
                  });
      break;
    }
    case "nlw-resize": {
      break;
    }
    default: {
      console.warn("Unknown `window.postMessage` type:", data.type, data);
    }
  }
});

self.addEventListener("beforeunload", connMan.teardown);

self.addEventListener("popstate", (event) => {
  switch (event.state.name) {
    case "hosting": {
      location.reload();
      break;
    }
    default: {
      console.warn("Unknown state:", event.state.name);
    }
  }
});

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
const finishLaunch = ({ isSuccess, data, config }) => {

  if (isSuccess) {

    const { hostID, json, nlogo } = data;

    byEID("id-display").innerText = hostID;

    // byEID("stats-modal-title").innerHTML = `Session Stats: ${config.sessionName}`;
    // byEID("code-modal-title").innerHTML = `Code: ${config.model}`;
    // byEID("model-info-modal-title").innerHTML = `Model Information: ${config.model}`;

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

  // (NEW): Modal responses to clicks & 'Esc' key
  document.onclick = (event) => {
    const onHostAPage = byEID("nlw-frame").classList.contains("hidden");

    if (onHostAPage) {
      if (event.target === descriptionModalContainer) {
        descriptionModalContainer.classList.add("modal-invis");
      }
    } else {
      if (event.target === moreDetailsModalContainer) {
        hideAllHostBModals();
        closeDetailsModalContainer();
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
        closeDetailsModalContainer();
      }
    }
  });

  // (NEW): HostA page modal
  const descriptionModalContainer = byEID("description-modal-container");

  byEID("read-more-button").onclick = () => {
    descriptionModalContainer.classList.remove("modal-invis");
  };

  byEID("close-description-modal-button").onclick = () => {
    descriptionModalContainer.classList.add("modal-invis");
  };

  // (NEW): Copy invite link functionality
  const copyInviteButton = byEID("copy-invite-button");

  copyInviteButton.onclick = () => {
    const inviteLink = `http://localhost:8080/join#${byEID("id-display").innerHTML}`;

    navigator.clipboard.writeText(inviteLink).then(() => {
        copyInviteButton.classList.remove("copy-invite-button-standard");
        copyInviteButton.classList.add("copy-invite-button-active");
        copyInviteButton.value = "Copied!";

        setTimeout(() => {
          copyInviteButton.classList.remove("copy-invite-button-active");
          copyInviteButton.classList.add("copy-invite-button-standard");
          copyInviteButton.value = "Copy Invite Link";
        }, 3000);
      }).catch(() => {
        alert("Error with copying link");
      });
  };

  // (NEW): Chat box controls
  const capacityDisplayText = byEID("capacity-display-text");
  const capacitySlider = byEID("max-num-clients-picker");

  capacitySlider.onchange = (e) => {
    capacityDisplayText.innerHTML = `${e.target.value}`;
  };

  // const sessionClosedChatBox = byEID("session-chat-box-closed");
  // const sessionClosedChatBoxBottom = byEID("session-chat-box-closed-bottom");
  // const sessionOpenChatBox = byEID("session-chat-box-open");
  // const sessionOpenChatHeader = byEID("session-open-chat-header");

  // const globalClosedChatBox = byEID("global-chat-box-closed");
  // const globalClosedChatBoxBottom = byEID("global-chat-box-closed-bottom");
  // const globalOpenChatBox = byEID("global-chat-box-open");
  // const globalOpenChatHeader = byEID("global-open-chat-header");

  // const singleChatThreshold = 1000;
  // const singlePopupThreshold = 600;

  // window.onresize = () => {
  //   if (commandCenterOpen()) {
  //     accomodatePopupNarrowScreen("commandCenter");
  //   } else if (globalChatOpen()) {
  //     accomodatePopupNarrowScreen("globalChat");
  //   } else if (sessionChatOpen()) {
  //     accomodatePopupNarrowScreen("sessionChat");
  //   }
  // };

  // const singleChatView = () => {
  //   return window.innerWidth <= singleChatThreshold;
  // };

  // const singlePopupView = () => {
  //   return window.innerWidth <= singlePopupThreshold;
  // };

  // const sessionChatOpen = () => {
  //   return !sessionOpenChatBox.classList.contains("invisible");
  // };

  // const globalChatOpen  = () => {
  //   return !globalOpenChatBox.classList.contains("invisible");
  // };

  // const commandCenterOpen = () => {
  //   return !commandCenterOpenBox.classList.contains("invisible");
  // };

  // const globalChatStandardPosition = () => {
  //   globalOpenChatBox.classList.add("global-chat-box-open-std");
  //   globalOpenChatBox.classList.remove("global-chat-box-open-offset");

  //   globalClosedChatBox.classList.add("global-chat-box-closed-std");
  //   globalClosedChatBox.classList.remove("global-chat-box-closed-offset");

  //   globalClosedChatBoxBottom.classList.add("global-chat-box-closed-bottom-std");
  //   globalClosedChatBoxBottom.classList.remove("global-chat-box-closed-bottom-offset");
  // };

  // const globalChatOffsetPosition = () => {
  //   globalOpenChatBox.classList.remove("global-chat-box-open-std");
  //   globalOpenChatBox.classList.add("global-chat-box-open-offset");

  //   globalClosedChatBox.classList.remove("global-chat-box-closed-std");
  //   globalClosedChatBox.classList.add("global-chat-box-closed-offset");

  //   globalClosedChatBoxBottom.classList.remove("global-chat-box-closed-bottom-std");
  //   globalClosedChatBoxBottom.classList.add("global-chat-box-closed-bottom-offset");
  // };

  // const accomodatePopupNarrowScreen = (popupType) => {
  //   if (popupType === "sessionChat") {
  //     if (singlePopupView()) {
  //       if (globalChatOpen()) {
  //         closeGlobalChat();
  //       }

  //       if (commandCenterOpen()) {
  //         closeCommandCenter();
  //       }
  //     } else if (singleChatView() && globalChatOpen()) {
  //       closeGlobalChat();
  //     }
  //   } else if (popupType === "globalChat") {
  //     if (singlePopupView()) {
  //       if (sessionChatOpen()) {
  //         closeSessionChat();
  //         globalChatStandardPosition();
  //       }

  //       if (commandCenterOpen()) {
  //         closeCommandCenter();
  //       }
  //     } else if (singleChatView() && sessionChatOpen()) {
  //       closeSessionChat();
  //       globalChatStandardPosition();
  //     }
  //   } else {
  //     if (singlePopupView()) {
  //       if (sessionChatOpen()) {
  //         closeSessionChat();
  //         globalChatStandardPosition();
  //       }

  //       if (globalChatOpen()) {
  //         closeGlobalChat();
  //       }
  //     }
  //   }
  // };

  // const openSessionChat = () => {
  //   sessionOpenChatBox.classList.remove("invisible");
  //   sessionClosedChatBox.classList.add("invisible");
  //   sessionClosedChatBoxBottom.classList.add("invisible");
  // };

  // const closeSessionChat = () => {
  //   sessionOpenChatBox.classList.add("invisible");
  //   sessionClosedChatBox.classList.remove("invisible");
  //   sessionClosedChatBoxBottom.classList.remove("invisible");
  // };

  // const openGlobalChat = () => {
  //   globalOpenChatBox.classList.remove("invisible");
  //   globalClosedChatBox.classList.add("invisible");
  //   globalClosedChatBoxBottom.classList.add("invisible");
  // };

  // const closeGlobalChat = () => {
  //   globalOpenChatBox.classList.add("invisible");
  //   globalClosedChatBox.classList.remove("invisible");
  //   globalClosedChatBoxBottom.classList.remove("invisible");
  // };

  // sessionClosedChatBox.onclick = () => {
  //   accomodatePopupNarrowScreen("sessionChat");
  //   openSessionChat();
  //   globalChatOffsetPosition();
  // };

  // sessionClosedChatBoxBottom.onclick = () => {
  //   accomodatePopupNarrowScreen("sessionChat");
  //   openSessionChat();
  //   globalChatOffsetPosition();
  // };

  // sessionOpenChatHeader.onclick = () => {
  //   closeSessionChat();
  //   globalChatStandardPosition();
  // };

  // globalClosedChatBox.onclick = () => {
  //   accomodatePopupNarrowScreen("globalChat");
  //   openGlobalChat();
  // };

  // globalClosedChatBoxBottom.onclick = () => {
  //   accomodatePopupNarrowScreen("globalChat");
  //   openGlobalChat();
  // };

  // globalOpenChatHeader.onclick = () => {
  //   closeGlobalChat();
  // };

  // const openCommandCenter = () => {
  //   commandCenterOpenBox.classList.remove("invisible");
  //   commandCenterClosedBox.classList.add("invisible");
  //   commandCenterClosedBottom.classList.add("invisible");
  // };

  // const closeCommandCenter = () => {
  //   commandCenterOpenBox.classList.add("invisible");
  //   commandCenterClosedBox.classList.remove("invisible");
  //   commandCenterClosedBottom.classList.remove("invisible");
  // };

  // const commandCenterClosedBottom = byEID("command-center-closed-bottom");
  // const commandCenterClosedBox = byEID("command-center-closed");
  // const commandCenterOpenBox = byEID("command-center-open");
  // const commandCenterOpenHeader = byEID("command-center-header");

  // commandCenterClosedBox.onclick = () => {
  //   accomodatePopupNarrowScreen("commandCenter");
  //   openCommandCenter();
  // };

  // commandCenterClosedBottom.onclick = () => {
  //   accomodatePopupNarrowScreen("commandCenter");
  //   openCommandCenter();
  // };

  // commandCenterOpenHeader.onclick = () => {
  //   closeCommandCenter();
  // };

  // (NEW): HostB page modals
  const moreDetailsButton = byEID("more-details-button");
  const closeMoreDetailsModalButton = byEID("close-more-details-modal-button");
  // const statsModalTab = byEID("stats-modal-tab");
  // const codeModalTab = byEID("code-modal-tab");
  // const modelInfoModalTab = byEID("model-info-modal-tab");

  const moreDetailsModalContainer = byEID("more-details-modal-container");
  const statsModalBody = byEID("stats-modal-body");
  // const codeModalBody = byEID("code-modal-body");
  // const modelInfoModalBody = byEID("model-info-modal-body");
  const hostBPageMain = byEID("nlw-frame");

  const detailsModalContainerInvis = () => {
    return moreDetailsModalContainer.classList.contains("modal-invis");
  };

  const openDetailsModalContainer = () => {
    if (detailsModalContainerInvis()) {
      moreDetailsModalContainer.classList.remove("modal-invis");
    }
  };

  const closeDetailsModalContainer = () => {
    if (!detailsModalContainerInvis()) {
      moreDetailsModalContainer.classList.add("modal-invis");
    }
  };

  const showModalBody = (modalBody) => {
    modalBody.classList.remove("modal-invis");
    modalBody.classList.remove("no-display");
    hostBPageMain.classList.add("no-select");
  };

  const hideModalBody = (modalBody) => {
    modalBody.classList.add("modal-invis");
    modalBody.classList.add("no-display");
    hostBPageMain.classList.remove("no-select");
  };

  const modalBodyNoDisplay = (modalBody) => {
    modalBody.classList.add("no-display");
  };

  // const hideAllHostBModals = () => {
  //   const statsModalIsInvis = statsModalBody.classList.contains("modal-invis");
  //   const codeModalIsInvis = codeModalBody.classList.contains("modal-invis");
  //   const modelInfoModalIsInvis = modelInfoModalBody.classList.contains("modal-invis");

  //   if (!statsModalIsInvis) {
  //     hideModalBody(statsModalBody);
  //     modalBodyNoDisplay(statsModalBody);
  //   } else if (!codeModalIsInvis) {
  //     hideModalBody(codeModalBody);
  //     modalBodyNoDisplay(codeModalBody);
  //   } else if (!modelInfoModalIsInvis) {
  //     hideModalBody(modelInfoModalBody);
  //     modalBodyNoDisplay(modelInfoModalBody);
  //   }
  // };

  moreDetailsButton.onclick = () => {
    openDetailsModalContainer();
    showModalBody(statsModalBody);
  };

  // statsModalTab.onclick = () => {
  //   hideAllHostBModals();
  //   showModalBody(statsModalBody);
  // };

  // codeModalTab.onclick = () => {
  //   hideAllHostBModals();
  //   showModalBody(codeModalBody);
  // };

  // modelInfoModalTab.onclick = () => {
  //   hideAllHostBModals();
  //   showModalBody(modelInfoModalBody);
  // };

  closeMoreDetailsModalButton.onclick = () => {
    closeDetailsModalContainer();
    hideAllHostBModals();
  };

  // (NEW): TODO
  const drawerClosed = byEID("drawer-closed");
  const drawerOpen = byEID("drawer-open");
  const drawerOptions = document.querySelectorAll(".drawer-text-container");

  const commandCenter = byEID("command-center-container");
  const modelCodeContainer = byEID("model-code-container");
  const modelInfoContainer = byEID("model-info-container");
  const sessionChat = byEID("session-chat-container");
  const globalChat = byEID("global-chat-container");

  const datasetToId = {
    "command-center": "command-center-container",
    "code": "model-code-container",
    "info": "model-info-container",
    "session-chat": "session-chat-container",
    "global-chat": "global-chat-container"
  };

  drawerClosed.onmouseover = () => {
    drawerClosed.classList.add("invisible");
    drawerOpen.classList.remove("invisible");
  };

  drawerOpen.onmouseleave = () => {
    drawerClosed.classList.remove("invisible");
    drawerOpen.classList.add("invisible");
  };

  // (NEW): TODO
  const computeOpenContainerObj = () => {
    const allContainers = [...document.querySelectorAll(".menu-option-container")];
    const openContainers = [];

    allContainers.forEach((container) => {
      if (![...container.classList].includes("invisible")) {
        openContainers.push(container);
      };
    });

    const openContainersOrdered = new Array(openContainers.length);
    const openContainerIdsOrdered = new Array(openContainers.length);

    switch(openContainers.length) {
      case 0:
        return { "containers": [], "ids": [] };
      case 1:
        return { "containers": openContainers, "ids": [openContainers[0].id] };
      case 2:
        openContainers.forEach((container) => {
          console.log(container.id)
          if (container.classList.contains("offset-one-container")) {
            openContainersOrdered[0] = container;
            openContainerIdsOrdered[0] = container.id;
          } else {
            openContainersOrdered[1] = container;
            openContainerIdsOrdered[1] = container.id;
          }
        });
        return { "containers": openContainersOrdered, "ids": openContainerIdsOrdered };
      case 3:
        openContainers.forEach((container) => {
          if (container.classList.contains("offset-two-containers")) {
            openContainersOrdered[0] = container;
            openContainerIdsOrdered[0] = container.id;
          } else if (container.classList.contains("offset-one-container")) {
            openContainersOrdered[1] = container;
            openContainerIdsOrdered[1] = container.id;
          } else {
            openContainersOrdered[2] = container;
            openContainerIdsOrdered[2] = container.id;
          }
        });
        return { "containers": openContainersOrdered, "ids": openContainerIdsOrdered };
    }
  };

  const closeContainer = (openContainers, containerPosition) => {
    const numOpenContainers = openContainers.length;
    const container = openContainers[containerPosition];

    if (numOpenContainers === 3) {
      if (containerPosition === 0) {
        container.classList.remove("offset-two-containers");
        container.classList.add("invisible");
        return;
      }

      if (containerPosition === 1) {
        container.classList.remove("offset-one-container");
        container.classList.add("invisible");

        openContainers[0].classList.remove("offset-two-containers");
        openContainers[0].classList.add("offset-one-container");
        return;
      }

      if (containerPosition === 2) {
        container.classList.add("invisible");

        openContainers[0].classList.remove("offset-two-containers");
        openContainers[0].classList.add("offset-one-container");

        openContainers[1].classList.remove("offset-one-container");
        return;
      }
    }

    if (numOpenContainers === 2) {
      if (containerPosition === 0) {
        container.classList.remove("offset-one-container");
        container.classList.add("invisible");
        return;
      }

      if (containerPosition === 1) {
        container.classList.add("invisible");

        openContainers[0].classList.remove("offset-one-container");
        return;
      }
    }

    if (numOpenContainers === 1) {
      container.classList.add("invisible");
      return;
    }
  };

  const computeOpenContainers = () => {
    return computeOpenContainerObj()["containers"];
  };

  const computeOpenContainerIds = () => {
    return computeOpenContainerObj()["ids"];
  };

  const computeNumContainers = () => {
    return computeOpenContainerObj().length;
  };

  const computeContainerPosition = (currentOptionId) => {
    const openContainerIds = computeOpenContainerIds();
    console.log("openContainerIds:", openContainerIds);

    if (openContainerIds.length === 0) {
      return -1;
    }

    const containerPosition = openContainerIds.indexOf(currentOptionId);
    return containerPosition;
  };

  drawerOptions.forEach((option) => {
    option.onclick = () => {
      const openContainers = computeOpenContainers();
      const currentOptionId = datasetToId[option.dataset.type];
      const containerPosition = computeContainerPosition(currentOptionId);

      if (containerPosition !== -1) {
        closeContainer(openContainers, containerPosition);
        return;
      }

      if (openContainers.length === 3) {
        openContainers[0].classList.remove("offset-two-containers");
        openContainers[0].classList.add("invisible");

        openContainers[1].classList.remove("offset-one-container");
        openContainers[1].classList.add("offset-two-containers");

        openContainers[2].classList.add("offset-one-container");
      };

      if (openContainers.length === 2) {
        openContainers[0].classList.remove("offset-one-container");
        openContainers[0].classList.add("offset-two-containers");

        openContainers[1].classList.add("offset-one-container");
      };

      if (openContainers.length === 1) {
        openContainers[0].classList.add("offset-one-container");
      }

      switch(option.dataset.type) {
        case "command-center":
          commandCenter.classList.remove("invisible");
          break;
        case "code":
          modelCodeContainer.classList.remove("invisible");
          break;
        case "info":
          modelInfoContainer.classList.remove("invisible");
          break;
        case "session-chat":
          sessionChat.classList.remove("invisible");
          break;
        case "global-chat":
          globalChat.classList.remove("invisible");
          break;
      }
    }
  });

  const setupButton = byEID("hnw-setup-button");
  const goButton = byEID("hnw-go-button");

  setupButton.onclick = () => {
    nlwManager.relay({ type: "hnw-setup-button" });
  };

  goButton.onclick = () => {
    if (goButton.classList.contains("go-button-active")) {
      goButton.classList.remove("go-button-active");
      goButton.classList.add("go-button-standard");
      goButton.innerText = "Go";
      nlwManager.relay({ type: "hnw-go-checkbox", goStatus: false });
      return;
    }

    goButton.classList.remove("go-button-standard");
    goButton.classList.add("go-button-active");
    goButton.innerText = "Stop";
    nlwManager.relay({ type: "hnw-go-checkbox", goStatus: true });
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

import ConnMan from "./conn/connection-manager.js";

import BandwidthManager     from "./ui/bandwidth-manager.js";
import LaunchControlManager from "./ui/launch-control-manager.js";
import MenuManager          from "./ui/menu-manager.js";
import ModalManager         from "./ui/modal-manager.js";
import NLWManager           from "./ui/nlw-manager.js";

import ChatManager from "/js/common/ui/chat-manager.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

// (String) => Unit
const onNLWManError = (data) => {
  if (data.subtype === "unknown-agent") {
    const { agentType: typ, agentID: id } = data;
    alert(`Fatal error received from client\n\nUnknown agent: ${typ} ${id}`);
  } else {
    alert(`Fatal error received from client: ${data}`);
  }
  self.location.reload();
};

// (Object[Any]) => Unit
const finishLaunch = ({ isSuccess, data, config }) => {

  if (isSuccess) {

    const { hostID, json, nlogo } = data;

    const title = config.modelType === "library" ? config.model : config.sessionName;

    setIT("id-display"           )(hostID);
    setIT("model-title-subheader")(config.sessionName);
    setIT("model-title-header"   )(title);

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

// (String) => Unit
const setNumClients = (numClients) => {
  setIT("num-clients-span"  )(numClients);
  setIT("slider-num-clients")(numClients);
};

// () => Number
const getCapacity = () => {
  return Math.max(0, Math.min(999, parseInt(byEID("max-num-clients-slider").value)));
};

let libraryConfig = null;

// () => Object[Any]
const getLibraryConfig = () => libraryConfig || {};

const launchControlManager =
  new LaunchControlManager( byEID("form-frame"), awaitLaunchHTTP, notifyUser
                          , finishLaunch, getLibraryConfig);

fetch("/library-config").
  then((res)  => res.json()).
  then((json) => {
    libraryConfig = json;
    launchControlManager.refreshInfo(libraryConfig);
  });

const sessionChatManager =
  new ChatManager( byEID("session-chat-output"), byEID("session-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); });

const globalChatManager =
  new ChatManager( byEID("global-chat-output"), byEID("global-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); });

const connMan =
  new ConnMan( sessionChatManager, globalChatManager
             , (jid, un, ri) =>   nlwManager.awaitJoinerInit(jid, un, ri)
             , (jid, ping)   => { nlwManager.registerPingStats(jid, ping); }
             , (pl)          => { nlwManager.relay(pl);                    }
             , (jid)         => { nlwManager.disown(jid);                  }
             , (cs)          => { bandwidthManager.updateTURNs(cs);        }
             , launchControlManager.passwordMatches, getCapacity()
             , notifyUser);

const nlwManager =
  new NLWManager( byEID("nlw-frame"), byEID("hnw-setup-button")
                , byEID("hnw-go-button"), connMan.broadcast, connMan.narrowcast
                , connMan.notifyPersistentPops, connMan.notifyRoles
                , onNLWManError);

document.addEventListener("DOMContentLoaded", () => {

  byEID("max-num-clients-slider").addEventListener("change", () => {
    connMan.updateFullness(getCapacity());
  });

  byEID("max-num-clients-slider").addEventListener("input", (e) => {
    setIT("slider-max-clients")(e.target.value);
  });

  byEID("copy-invite-button").onclick = (event) => {

    const self = event.target;

    const origin     = window.location.origin;
    const hash       = byEID("id-display").textContent;
    const inviteLink = `${origin}/join#${hash}`;

    navigator.clipboard.writeText(inviteLink).then(
      () => {
        self.classList.add("active");
        self.value = "Copied!";
        setTimeout(() => {
          self.classList.remove("active");
          self.value = "Copy Invite Link";
        }, 600);
      }
    ).catch(
      (error) => {
        alert(`Error copying link: ${error.message}`);
      }
    );

  };

  const modalManager =
    new ModalManager( () => byEID("nlw-frame").classList.contains("hidden")
                    , byEID("description-modal-container")
                    , byEID("more-details-modal-container")
                    , byEID("more-details-button")
                    , byEID("close-more-details-modal-button")
                    , byEID("read-more-button")
                    , byEID("close-description-modal-button")
                    );

  document.onclick = (event) => {
    modalManager.onDocumentClick(event);
  };

  document.addEventListener("keydown", (event) => {
    modalManager.onKeydown(event);
  });

  const menuManager = new MenuManager(byEID("drawer-root"), window.innerWidth);

  window.onresize = () => {
    menuManager.registerResize(window.innerWidth);
  };

  nlwManager.init();

});

const bandwidthManager =
    new BandwidthManager( setIT("bandwidth-span"), setIT("new-send-span")
                        , setNumClients, setIT("num-congested-span")
                        , setIT("activity-status-span"), setIT("num-turn-span")
                        , nlwManager.notifyCongested, nlwManager.notifyUncongested);

const queryString = new URLSearchParams(window.location.search);
const params      = Object.fromEntries(queryString.entries());

if (params.embedded === "true") {
  document.querySelectorAll(".page-header")[0].style.display = "none";
}

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

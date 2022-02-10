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

// (NEW): Added callback functions b/c constructor now accounts for read & unread messages
const sessionChatManager =
  new ChatManager( byEID("session-chat-output"), byEID("session-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); }
                 , () => {}
                 , () => {});

const globalChatManager =
  new ChatManager( byEID("global-chat-output"), byEID("global-chat-input")
                 , () => { alert("Your chat message is too large"); }
                 , () => { alert("You are sending chat messages too fast"); }
                 , () => {}
                 , () => {});

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
  const modalContainer = byEID("modal-container");

  window.onclick = (event) => {
    if (event.target === modalContainer) {
      modalContainer.classList.add("hidden");
    }
  };

  byEID("read-more-button").onclick = () => {
    modalContainer.classList.remove("hidden");
  };

  byEID("close-modal-button").onclick = () => {
    modalContainer.classList.add("hidden");
  };

  document.addEventListener("keydown", (event) => {
    if (!modalContainer.classList.contains("hidden") && event.key === "Escape") {
      modalContainer.classList.add("hidden");
    }
  });

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

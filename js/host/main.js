import ConnectionManager from "./conn/connection-manager.js";

import BandwidthManager     from "./ui/bandwidth-manager.js";
import LaunchControlManager from "./ui/launch-control-manager.js";
import NLWManager           from "./ui/nlw-manager.js";

// (String) => Element?
const byEID = (eid) => document.getElementById(eid);

const onNLWManError = (subtype) => {
  alert(`Fatal error received from client: ${subtype}`);
  self.location.reload();
};

// (Object[Any]) => Unit
const finishLaunch = ({ isSuccess, data }) => {

  if (isSuccess) {

    const { hostID, json, nlogo, sessionName } = data;

    document.getElementById("id-display").innerText = hostID;

    history.pushState({ name: "hosting" }, "hosting");

    nlwManager.show();
    nlwManager.becomeOracle(hostID, json, nlogo);

    connMan.connect(hostID, nlogo, sessionName);

    setInterval(() => {
      bandwidthManager.updateCongestionStats(connMan.getChannelObj());
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

const launchModel = (model) => {
  launchControlManager.launch(model).
    then(finishLaunch);
};

const awaitLaunchHTTP = (data) => fetch("/launch-session", data);
const notifyUser      = (s) => { alert(s); };

const launchControlManager =
  new LaunchControlManager( byEID("form-frame"), awaitLaunchHTTP, notifyUser
                          , finishLaunch);

const connMan =
  new ConnectionManager( (jid, un)   =>   nlwManager.awaitJoinerInit(jid, un)
                       , (jid, ping) => { nlwManager.registerPing(jid, ping);   }
                       , (pl)        => { nlwManager.relay(pl);                 }
                       , ()          => { nlwManager.disown();                  }
                       , launchControlManager.passwordMatches);

const nlwManager =
  new NLWManager( byEID("nlw-frame"), launchModel, connMan.broadcast
                , connMan.narrowcast, onNLWManError);

document.addEventListener("DOMContentLoaded", nlwManager.init);

// (String) => (String) => Unit
const setIT = (id) => (text) => {
  byEID(id).innerText = text;
};

const bandwidthManager =
    new BandwidthManager( setIT("bandwidth-span"), setIT("new-send-span")
                        , setIT("num-clients-span"), setIT("num-congested-span")
                        , setIT("activity-status-span")
                        , nlwManager.notifyCongested, nlwManager.notifyUncongested);

// Honestly, this will probably not run before the tab closes.
// Not much I can do about that.  --Jason B. (8/21/20)
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

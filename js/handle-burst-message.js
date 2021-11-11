import { awaitFrame, spamFrame } from "./await.js";

// (Object[Any]) => (Object[Any]) => Unit
const handleInitialModel = (bundle) => ({ role, token, view, state }) => {

  bundle.setStatus("Model and world acquired!  Waiting for NetLogo Web to be ready...");

  const postInitialInterface =
    () => {
      bundle.setStatus("Loading up interface in NetLogo Web...");
      const initialInterface =
        { username: bundle.getUsername()
        , role
        , token
        , view
        };
      return awaitFrame(bundle.frame)("hnw-load-interface", initialInterface);
    };

  const postInitialState =
    () => {
      bundle.setStatus("Model loaded and ready for you to use!");
      bundle.notifyBootedUp();
      const parcel =
        { type:   "nlw-state-update"
        , update: state
        };
      bundle.postToNLW(parcel);
    };

  spamFrame(bundle.frame)("hnw-are-you-ready-for-interface").
    then(postInitialInterface).
    then(postInitialState);

};

// (Object[Any]) => (Object[Any]) => Unit
export default (bundle) => (datum) => {

  switch (datum.type) {

    case "initial-model": {
      handleInitialModel(bundle)(datum);
      break;
    }

    case "state-update": {
      bundle.postToNLW({
        update: datum.update
      , type:   "nlw-apply-update"
      });
      break;
    }

    case "relay": {
      bundle.postToNLW(datum.payload);
      break;
    }

    case "hnw-resize": {
      break;
    }

    default: {
      console.warn(`Unknown bursted sub-event type: ${datum.type}`);
    }

  }

};

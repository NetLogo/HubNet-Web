// (Object[Any]) => (Object[Any]) => Unit
const handleInitialModel = (bundle) => ({ role, token, view, state }) => {

  bundle.statusManager.waitingForNLWBoot();

  const awaitInitialInterface =
    () => {
      bundle.statusManager.loadingNLWUI();
      const initialInterface =
        { username: bundle.getUsername()
        , role
        , token
        , view
        };
      return bundle.awaitNLW("hnw-load-interface", initialInterface);
    };

  const postInitialState =
    () => {
      bundle.statusManager.modelLoaded();
      bundle.notifyBootedUp();
      const parcel =
        { type:   "nlw-state-update"
        , update: state
        };
      bundle.postToNLW(parcel);
    };

  awaitInitialInterface().then(postInitialState);

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

// (Object[Any]) => (Object[Any]) => Unit
export default (bundle) => (datum) => {

  switch (datum.type) {

    case "initial-model": {
      handleInitialModel(bundle)(datum);
      break;
    }

    case "state-update": {
      bundle.updateNLW(datum.update);
      break;
    }

    case "relay": {
      bundle.relayToNLW(datum);
      break;
    }

    case "hnw-resize": {
      break;
    }

    default: {
      console.warn("Unknown bursted sub-event type:", datum.type);
    }

  }

};

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
      return bundle.awaitLoadInterface(initialInterface);
    };

  const postInitialState =
    () => {
      bundle.statusManager.modelLoaded();
      bundle.notifyBootedUp();
      bundle.updateNLW(state);
    };

  awaitInitialInterface().then(postInitialState);

};

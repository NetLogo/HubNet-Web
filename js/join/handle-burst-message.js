import SimpleQueue from "/js/common/simple-queue.js";

// (Object[Any]) => (Object[Any]) => Unit
export default (bundle) => {

  const relayQueue = new SimpleQueue(bundle.relayToNLW);

  return (datum) => {

    switch (datum.type) {

      case "append-output": {
        bundle.appendOutput(datum.output);
        break;
      }

      case "initial-model": {
        handleInitialModel(bundle)(datum);
        break;
      }

      case "set-output": {
        bundle.setOutput(datum.output);
        break;
      }

      case "state-update": {
        bundle.updateNLW(datum.update);
        break;
      }

      case "relay": {
        relayQueue.enqueue(datum);
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

};

// (Object[Any]) => (Object[Any]) => Unit
const handleInitialModel = (bundle) => ({ token, view, state }) => {

  bundle.statusManager.waitingForNLWBoot();

  const awaitInitialInterface =
    () => {
      bundle.statusManager.loadingNLWUI();
      return bundle.getRoleDataP().then(
        (role) => {
          const initialInterface =
            { username: bundle.getUsername()
            , role
            , token
            , view
            };
          return bundle.awaitLoadInterface(initialInterface);
        }
      );
    };

  const postInitialState =
    () => {
      bundle.statusManager.modelLoaded();
      bundle.notifyBootedUp();
      bundle.updateNLW(state);
    };

  awaitInitialInterface().then(postInitialState);

};

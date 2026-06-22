import SimpleQueue from "/js/common/simple-queue.js";

// (Object[Any]) => (Object[Any]) => Unit
export default (bundle) => {

  const relayQueue = new SimpleQueue(bundle.relayToNLW);

  return async (datum) => {

    switch (datum.type) {

      case "append-output": {
        bundle.appendOutput(datum.output);
        break;
      }

      case "initial-model": {
        await handleInitialModel(bundle)(datum);
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

// (Object[Any]) => (Object[Any]) => Promise[Unit]
const handleInitialModel = (bundle) => async ({ token, view, state }) => {

  bundle.statusManager.waitingForNLWBoot();

  const awaitInitialInterface =
    async () => {
      bundle.statusManager.loadingNLWUI();
      const role = await bundle.getRoleDataP();
      const initialInterface =
        { username: bundle.getUsername()
        , role
        , token
        , view
        };
      return bundle.awaitLoadInterface(initialInterface);
    };

  const postInitialState =
    async () => {
      bundle.statusManager.modelLoaded();
      bundle.notifyBootedUp();
      await bundle.updateNLW(state);
    };

  await awaitInitialInterface();
  await postInitialState();

};

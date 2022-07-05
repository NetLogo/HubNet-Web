import { version } from "/js/static/version.js";

import { checkTURNiness } from "/js/common/util.js";

export default class ChannelHandler {

  #bundle      = undefined; // Object[Any]
  #recentPings = undefined; // Array[Number]

  // (Object[Any]) => ChannelHandler
  constructor(bundle) {
    this.#bundle = bundle;
    this.reset();
  }

  // () => Unit
  reset = () => {
    this.#recentPings = [];
  };

  // (Object[Any]) => Unit
  run = (datum) => {

    const b = this.#bundle;

    switch (datum.type) {

      case "chat": {
        this.#bundle.addChatLine(datum.message, "");
        break;
      }

      case "chat-relay": {
        this.#bundle.addChatLine(datum.message, datum.username);
        break;
      }

      case "connection-established": {
        handleConnEst(b)(datum);
        break;
      }

      case "login-successful": {
        b.statusManager.loadingNLW();
        b.handleLogin();
        break;
      }

      case "incorrect-password": {
        b.statusManager.rejectedOverPassword();
        b.notifyUser("Incorrect password");
        b.handleIncorrectPassword();
        b.resetConn();
        break;
      }

      case "no-username-given": {
        b.statusManager.rejectedOverBlankName();
        b.notifyUser("You must provide a username.");
        b.handleMissingUsername();
        b.resetConn();
        break;
      }

      case "num-clients": {
        b.setNumClients(datum.num);
        break;
      }

      case "username-already-taken": {
        b.statusManager.rejectedOverDupeName();
        b.notifyUser("Username already in use.");
        b.handleUsernameIsTaken();
        b.resetConn();
        break;
      }

      case "ping": {
        handlePing(b, this.#recentPings)(datum);
        break;
      }

      case "hnw-burst": {
        b.enqueue(datum.parcel);
        break;
      }

      case "bye-bye": {
        b.terminate();
        b.notifyUser("The host disconnected from the activity");
        break;
      }

      case "keep-alive": {
        break;
      }

      default: {
        console.warn("Unknown channel event type:", datum.type);
      }

    }

  };

}

// (Object[Any], Array[Number]) => (Object[Any]) => Unit
const handlePing = (bundle, pings) => ({ id, lastPing }) => {

  bundle.send("pong", { id });

  if (lastPing !== undefined) {

    pings.push(lastPing);

    if (pings.length > 5) {
      pings.shift();
    }

    const add         = (x, y) => x + y;
    const averagePing = Math.round(pings.reduce(add) / pings.length);
    bundle.setLatency(averagePing);

  }

};

// (Object[Any]) => (Object[Any]) => Unit
const handleConnEst = (bundle) => ({ protocolVersion }) => {

  if (protocolVersion !== version) {
    bundle.notifyUser(`HubNet protocol version mismatch!  You are using protocol version '${version}', while the host is using version '${protocolVersion}'.  To ensure that you and the host are using the same version of HubNet Web, all parties should clear their browser cache and refresh the page.  Your connection will now close.`);
    bundle.disconnect();
  }

  bundle.getConnectionStats().then(
    (stats) => {
      bundle.setConnectionType(checkTURNiness(stats));
    }
  );

};

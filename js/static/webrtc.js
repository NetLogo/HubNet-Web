import deepFreeze from "/js/static/deep-freeze.js";
import cfg        from "/js/static/client-config.js";

// type Protocol = { connection :: RTCPeerConnection, channel :: RTCDataChannel, socket :: WebSocket }
// type Channel  = RTCDataChannel

// STUN/TURN config is per-deployment via /js/config.js (these creds ship to every
// client, so they are not secret). Defaults are local-dev values; deployments
// override them through the config served at /js/config.js.
const turnHost = cfg.turnHost ?? "localhost";
const turnUser = cfg.turnUser ?? "guest";
const turnPass = cfg.turnPass ?? "mycoolpassword";

const commonConfig = {
  iceServers: [
    { urls: ["", "1", "2", "3", "4"].map((x) => `stun:stun${x}.l.google.com:19302`) }
  , { urls: `stun:stun.${turnHost}` }
  , { urls: `stun:stun.${turnHost}`
    , username: turnUser
    , credential: turnPass
    }
  , { urls: `turn:turn.${turnHost}`
    , username: turnUser
    , credential: turnPass
    }
  ]
};

deepFreeze(commonConfig);

export { commonConfig };

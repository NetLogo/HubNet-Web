const cfg = (typeof window !== "undefined" && window.__HNW_CONFIG__) || {};

const root      = cfg.root      ?? "localhost";
const galaProto = cfg.galaProto ?? "http";
const wsProto   = cfg.wsProto   ?? "ws";

// Port suffixes. "" means the standard port (no `:port` in the URL). Local dev
// serves Galapagos on 9000 and HubNet Web on 8080; deployments override these via
// the config served at /js/config.js (e.g. prod galaPort "9001", hnwPort "").
const galaPort  = cfg.galaPort  ?? "9000";
const hnwPort   = cfg.hnwPort   ?? "8080";

const galapagos = galaPort ? `${root}:${galaPort}` : root;
const hnw       = hnwPort  ? `${root}:${hnwPort}`  : root;

export { galapagos, galaProto, hnw, root, wsProto };

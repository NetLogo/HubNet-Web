// Google Analytics loader. The measurement id comes from /js/config.js (window.__HNW_CONFIG__.gaId) served via the
// Controller (not a real file). An empty/missing id disables analytics entirely, so dev and staging emit nothing and
// never pollute the production property. Include AFTER /js/config.js.  See `hnw.env.example`.  -Jeremy B June 2026
(function initAnalytics() {
  "use strict";

  const gaId = (window.__HNW_CONFIG__ || {}).gaId;
  if (!gaId) { return; }

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  // gtag must forward its raw `arguments` object, per Google's canonical snippet.
  // eslint-disable-next-line prefer-rest-params
  function gtag() { window.dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", gaId);
})();

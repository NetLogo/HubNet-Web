const oldFirefoxBad = `<p>Firefox is only supported for versions 111
  and later.</p>`;

const changeFirefoxConfig = `In order to use HubNet Web in Firefox, you will need to enable an flag in your browser's configuration.  To do this, go to the URL 'about:config' and search for 'dom.workers.modules.enabled'.  This flag defaults to 'false', but must be set to 'true'.

Would you like to hide this message forever?`;

const regex       = /^.*(Firefox)\/([0-9.]+)$/;
const browserName = navigator.userAgent;

if (regex.test(browserName)) {
  const [ , ff, version] = browserName.match(regex);
  if (ff !== null) {
    if (parseFloat(version) >= 111) {
      if (parseFloat(version) < 114) {
        const mode = localStorage.getItem("hideFFNotification") || "false";
        if (mode === "false") {
          const res = confirm(changeFirefoxConfig) || false;
          localStorage.setItem("hideFFNotification", res);
        }
      }
    } else {
      document.body.innerHTML = oldFirefoxBad;
    }
  }
}

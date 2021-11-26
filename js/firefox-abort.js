if (navigator.userAgent.includes("Firefox")) {
  document.body.innerHTML = `<p>We're sorry, but Firefox is not currently
  supported.  We plan to add support for Firefox once its "module Worker"
  functionality has been implemented.  Updates on Mozilla's progress can be found on
  <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1247687">Firefox issue
  #1247687</a>.</p>

  <p>In the meantime, all other major browsers can be used to access HubNet Web.</p>`;
}

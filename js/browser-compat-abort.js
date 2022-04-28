const firefoxBad = `<p>We're sorry, but Firefox is not currently supported.
  We plan to add support for Firefox once its "module Worker" functionality
  has been implemented.  Updates on Mozilla's progress can be found on
  <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1247687">Firefox issue
  #1247687</a>.</p>`;

const useTheseInstead = "<p>In the meantime: Chromium, Brave, Chrome, Opera, Safari, and Edge can all be used to access HubNet Web.</p>";

const checkUA = (name) => navigator.userAgent.includes(name);

if (checkUA("Firefox")) {
  document.body.innerHTML = `${firefoxBad}\n\n${useTheseInstead}`;
}

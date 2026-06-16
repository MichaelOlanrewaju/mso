/* ═══════════════════════════════════════════════════════════
   MSO DIGITAL — PERSISTENT AUTH HELPER
   Include this on every page: <script src="mso-auth.js"></script>
   
   Uses localStorage (survives tab close + app close) with a
   30-day rolling expiry. sessionStorage is NOT used anymore.
═══════════════════════════════════════════════════════════ */

var MSO_AUTH = (function () {

  var KEY     = 'mso_session';
  var EXPIRY  = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  /* ── Save user after successful login ── */
  function save(userObj) {
    var record = {
      user:    userObj,
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(record));
    } catch (e) {
      /* storage full or private mode — fall back silently */
      sessionStorage.setItem(KEY, JSON.stringify(record));
    }
  }

  /* ── Read & validate session ── */
  function get() {
    var raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
    if (!raw) return null;
    try {
      var record = JSON.parse(raw);
      /* expired? */
      if (Date.now() - record.savedAt > EXPIRY) {
        clear();
        return null;
      }
      /* roll the expiry on each page load (keeps active users logged in) */
      record.savedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(record)); } catch(e) {}
      return record.user;
    } catch (e) {
      clear();
      return null;
    }
  }

  /* ── Destroy session ── */
  function clear() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    /* also wipe the old sessionStorage key used by earlier version */
    sessionStorage.removeItem('mso_u');
  }

  /* ── Require login — redirect if not authed ── */
  function require(stationFilter) {
    /* also try the old sessionStorage key so existing sessions aren't broken */
    var oldRaw = sessionStorage.getItem('mso_u');
    if (oldRaw) {
      try {
        var oldUser = JSON.parse(oldRaw);
        save(oldUser);               /* migrate to localStorage */
        sessionStorage.removeItem('mso_u');
      } catch(e) {}
    }

    var user = get();
    if (!user) {
      window.location.replace('login.html');
      return null;
    }
    /* optional: make sure this page is for the right station */
    if (stationFilter && user.station && user.station !== stationFilter && !user.pick) {
      window.location.replace('dashboard-' + user.station + '.html');
      return null;
    }
    return user;
  }

  /* ── Route after login (same logic that was in login.html) ── */
  function route(userObj) {
    save(userObj);
    window.location.href = (userObj.pick || !userObj.station)
      ? 'select.html'
      : 'dashboard-' + userObj.station + '.html';
  }

  /* ── Logout ── */
  function logout() {
    clear();
    window.location.replace('login.html');
  }

  return { save: save, get: get, clear: clear, require: require, route: route, logout: logout };

}());

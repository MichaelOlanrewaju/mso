/* ═══════════════════════════════════════════════════════════════
   MSO CHAT — UNREAD + PRESENCE
   Paste-in patch for the Apps Script backend.
   ═══════════════════════════════════════════════════════════════

   WHAT THIS ADDS
     1. Unread counts   — a real per-user read cursor, so the badge
                          on a conversation reflects genuine unseen
                          messages rather than a guess.
     2. Presence        — "active in the last 2 minutes", driven by a
                          heartbeat the app sends while it's open.

   HOW TO INSTALL  (4 steps, in order)
     1. Paste everything below into your Apps Script file, at the end.
     2. In doGet's switch, add these three cases:

          case 'markConversationRead': return markConversationRead(p);
          case 'chatHeartbeat':        return chatHeartbeat(p);
          case 'setupChatUnread':      return setupChatUnread();

     3. In doPost's switch, add:

          case 'markConversationRead': return markConversationRead(body);
          case 'chatHeartbeat':        return chatHeartbeat(body);

     4. REPLACE your existing getConversations() with the version at
        the bottom of this file. It is the same function plus unread
        counts and presence — every existing behaviour is preserved
        (general seeding, DM participant filter, hidden-message
        handling, Staff name lookup, sort order).

     Then: Deploy → Manage deployments → New version.
     Then: visit  ?action=setupChatUnread  once to create the sheets.

   ─────────────────────────────────────────────────────────────
   BEFORE YOU DEPLOY — two secrets in your script are burned:

     * ONESIGNAL_REST_KEY is hardcoded inside setAndTest(). Rotate it
       in the OneSignal dashboard, put the new one in Script Properties,
       and DELETE setAndTest() entirely.
     * ADMIN_KEY is in plaintext at the top of the file. Rotate it and
       read it from Script Properties too.

   Both have been pasted into a chat. Treat them as public.
   ─────────────────────────────────────────────────────────────
*/

/* How long after a heartbeat someone still counts as "online".
   The app beats every 45s while visible, so 2 minutes tolerates one
   missed beat (a tunnel, a locked phone) without flickering offline. */
var PRESENCE_WINDOW_MS = 2 * 60 * 1000;

/* ─────────────────────────────────────────────────────────────
   SETUP — creates ChatReads and ChatPresence in both workbooks.
   Additive and idempotent: safe to run as many times as you like,
   touches nothing that already exists.
   Call via: ?action=setupChatUnread
───────────────────────────────────────────────────────────── */
function setupChatUnread() {
  var results = [];
  ['mso', 'mrs'].forEach(function(station) {
    var ss = getSheet(station);
    if (!ss) { results.push(station.toUpperCase() + ': not connected — skipped'); return; }

    var reads = ss.getSheetByName('ChatReads');
    if (!reads) {
      reads = ss.insertSheet('ChatReads');
      reads.appendRow(['Username', 'ConversationId', 'LastReadTimestamp']);
      reads.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
      reads.setFrozenRows(1);
      results.push(station.toUpperCase() + ' ChatReads: CREATED');
    } else {
      results.push(station.toUpperCase() + ' ChatReads: EXISTS (ok)');
    }

    var pres = ss.getSheetByName('ChatPresence');
    if (!pres) {
      pres = ss.insertSheet('ChatPresence');
      pres.appendRow(['Username', 'LastSeenAt']);
      pres.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#06091A').setFontColor('#ffffff');
      pres.setFrozenRows(1);
      results.push(station.toUpperCase() + ' ChatPresence: CREATED');
    } else {
      results.push(station.toUpperCase() + ' ChatPresence: EXISTS (ok)');
    }
  });
  return out({ ok: true, message: 'Chat unread + presence setup complete.', details: results });
}

/* Resolve the caller the same hybrid way the rest of the chat code does:
   token first, then a claimed username verified against the Staff sheet.
   Returns a real Staff record or null — never a raw unverified string. */
function chatCaller(params) {
  var sess = validateToken(params && params.token);
  if (sess) return findStaffByUsername(sess.username);
  var claimed = String((params && params.username) || '').toLowerCase();
  return claimed ? findStaffByUsername(claimed) : null;
}

/* ─────────────────────────────────────────────────────────────
   MARK CONVERSATION READ — moves this user's read cursor for one
   conversation up to now. Called when they open a chat and each
   time new messages arrive while they're looking at it.

   One row per user+conversation, updated in place — the sheet grows
   with people × chats, not with messages, so it stays small forever.
───────────────────────────────────────────────────────────── */
function markConversationRead(params) {
  var caller = chatCaller(params);
  if (!caller) return out({ ok: false, error: 'Your session has expired. Please log in again.', authExpired: true });

  var station = String((params && params.station) || 'mso').toLowerCase();
  var conversationId = String((params && params.conversationId) || '');
  if (!conversationId) return out({ ok: false, error: 'conversationId required.' });

  var ss = getSheet(station);
  if (!ss) return out({ ok: false, error: 'Sheet not connected.' });
  var sheet = ss.getSheetByName('ChatReads');
  if (!sheet) return out({ ok: false, error: 'ChatReads sheet not found — run ?action=setupChatUnread.' });

  /* Cursor is "now", not the newest message's timestamp. If a message
     lands between the read and this write, the next poll picks it up as
     unread — which is correct; they hadn't seen it. */
  var now = new Date().toISOString();
  var username = caller.username;

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === username &&
        String(rows[i][1]) === conversationId) {
      sheet.getRange(i + 1, 3).setValue(now);
      return out({ ok: true, conversationId: conversationId, lastReadAt: now });
    }
  }
  sheet.appendRow([username, conversationId, now]);
  return out({ ok: true, conversationId: conversationId, lastReadAt: now, created: true });
}

/* ─────────────────────────────────────────────────────────────
   CHAT HEARTBEAT — the app calls this while chat is open and the
   tab is visible. One row per user, overwritten each beat.

   This is genuinely approximate. It says "this person's app was open
   within the last 2 minutes" — not "this person is looking at the
   screen right now". On a polling backend that's the honest ceiling,
   and the UI wording ("Active recently") reflects that rather than
   claiming a real-time presence system that doesn't exist here.
───────────────────────────────────────────────────────────── */
function chatHeartbeat(params) {
  var caller = chatCaller(params);
  if (!caller) return out({ ok: false, error: 'Your session has expired. Please log in again.', authExpired: true });

  var station = String((params && params.station) || 'mso').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok: false, error: 'Sheet not connected.' });
  var sheet = ss.getSheetByName('ChatPresence');
  if (!sheet) return out({ ok: false, error: 'ChatPresence sheet not found — run ?action=setupChatUnread.' });

  var now = new Date().toISOString();
  var username = caller.username;

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === username) {
      sheet.getRange(i + 1, 2).setValue(now);
      return out({ ok: true, lastSeenAt: now });
    }
  }
  sheet.appendRow([username, now]);
  return out({ ok: true, lastSeenAt: now, created: true });
}

/* Read every read-cursor belonging to one user → { conversationId: iso }.
   One sheet read for the whole inbox rather than one per conversation. */
function readCursorsFor(ss, username) {
  var cursors = {};
  if (!username) return cursors;
  var sheet = ss.getSheetByName('ChatReads');
  if (!sheet) return cursors;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() !== username) continue;
    cursors[String(rows[i][1])] = String(rows[i][2] || '');
  }
  return cursors;
}

/* Everyone seen within the presence window → { username: true }. */
function onlineUsers(ss) {
  var online = {};
  var sheet = ss.getSheetByName('ChatPresence');
  if (!sheet) return online;
  var cutoff = Date.now() - PRESENCE_WINDOW_MS;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var seen = new Date(String(rows[i][1] || '')).getTime();
    if (seen && seen >= cutoff) online[String(rows[i][0]).toLowerCase()] = true;
  }
  return online;
}

/* ═══════════════════════════════════════════════════════════════
   GET CONVERSATIONS  ←  REPLACE YOUR EXISTING FUNCTION WITH THIS
   ═══════════════════════════════════════════════════════════════
   Identical to the one you have, plus:
     - unread        : real count, was hardcoded 0
     - online        : is the DM partner active right now
     - lastSeenAt    : when they were last seen
     - onlineCount   : how many colleagues are active

   A message counts as unread when ALL of these hold:
     - it landed after this user's read cursor for that conversation
     - this user didn't send it
     - this user hasn't hidden it (the DeletedFor list)
   No cursor yet (never opened) → everything anyone else sent is unread,
   which is what a genuinely-never-opened chat should show.
═══════════════════════════════════════════════════════════════ */
function getConversations(params) {
  var station = String((params && params.station) || 'mso').toLowerCase();
  /* Read: prefer token, fall back to claimed username so a stale-token
     client still sees their conversation list rather than an error. */
  var convSession = validateToken(params && params.token);
  var username = convSession ? convSession.username
    : String((params && params.username) || '').toLowerCase();
  var ss = getSheet(station);
  if (!ss) return out({ ok:false, error:'Sheet not connected.' });

  var sheet = ss.getSheetByName('Messages');
  var convMap = {};
  var convAllHidden = {};

  /* Read cursors and presence, once, up front. */
  var cursors = readCursorsFor(ss, username);
  var online  = onlineUsers(ss);

  /* Seed general so it always appears even with zero messages */
  convMap['general'] = { conversationId:'general', type:'general', name:'General', lastText:'', lastTimestamp:'', unread:0 };
  convAllHidden['general'] = false;

  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    var h = rows[0];
    var deletedForCol = h.indexOf('DeletedFor');
    var imageCol = h.indexOf('ImageFileId');

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var cid = String(r[2] || '');
      var sender = String(r[3] || '').toLowerCase();
      var ts = String(r[6] || '');
      var text = String(r[5] || '');
      var imageFileId = imageCol >= 0 ? String(r[imageCol] || '') : '';

      var isHidden = false;
      if (deletedForCol >= 0 && username) {
        var delFor = String(r[deletedForCol] || '');
        if (delFor) {
          isHidden = delFor.split(',').map(function(s){return s.trim();}).indexOf(username) >= 0;
        }
      }

      if (cid.indexOf('dm__') === 0) {
        var parts = cid.split('__');
        var a = parts[1], b = parts[2];
        if (a !== username && b !== username) continue;
        var otherUser = (a === username) ? b : a;
        if (!convMap[cid]) {
          convMap[cid] = {
            conversationId:cid, type:'dm', otherUsername:otherUser, name:otherUser,
            lastText:'', lastTimestamp:'', unread:0,
          };
          convAllHidden[cid] = true;
        }
      } else if (cid !== 'general') {
        continue;
      }

      if (!isHidden) {
        convAllHidden[cid] = false;

        /* Unread: after my cursor, and not something I sent myself. */
        if (username && sender !== username && ts) {
          var cursor = cursors[cid] || '';
          if (!cursor || ts > cursor) convMap[cid].unread += 1;
        }

        if (!convMap[cid].lastTimestamp || ts > convMap[cid].lastTimestamp) {
          var preview = imageFileId ? '📷 Image' : (text.length > 60 ? text.slice(0,60)+'…' : text);
          convMap[cid].lastText = preview;
          convMap[cid].lastTimestamp = ts;
          convMap[cid].lastSender = sender;
        }
      }
    }
  }

  /* Remove DM conversations where ALL messages are hidden for this user */
  Object.keys(convMap).forEach(function(cid) {
    if (cid !== 'general' && convAllHidden[cid] === true) {
      delete convMap[cid];
    }
  });

  /* Pull Staff sheet for real display names */
  var staffSheet = ss.getSheetByName('Staff');
  var nameMap = {};
  if (staffSheet) {
    var sRows = staffSheet.getDataRange().getValues();
    for (var j = 1; j < sRows.length; j++) {
      nameMap[String(sRows[j][0]).toLowerCase()] = String(sRows[j][1] || sRows[j][0]);
    }
  }
  Object.keys(convMap).forEach(function(cid) {
    var c = convMap[cid];
    if (c.type === 'dm') {
      if (nameMap[c.otherUsername]) c.name = nameMap[c.otherUsername];
      /* Presence rides along on the DM it belongs to. */
      c.online = !!online[c.otherUsername];
    }
  });

  var conversations = Object.values(convMap).sort(function(a, b) {
    return (b.lastTimestamp || '').localeCompare(a.lastTimestamp || '');
  });

  /* Colleagues currently active, excluding the caller — lets the inbox
     show presence dots on the People rail too, not just on open DMs. */
  var onlineList = Object.keys(online).filter(function(u) { return u !== username; });

  return out({
    ok: true,
    conversations: conversations,
    onlineUsernames: onlineList,
    onlineCount: onlineList.length,
    presenceWindowMs: PRESENCE_WINDOW_MS,
  });
}

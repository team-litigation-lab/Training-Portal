/* ============================================================
   LSH Training Portal → Google Sheet: 🕘 Platform Attendance
   Keeps a "Platform Attendance" tab in this spreadsheet up to date with the
   attendance trainers take on the platform (each course's Admin → 🕘 Attendance
   tab and the portal's /attendance.html), for every program and batch.

   Set up (once, by someone who can edit the sheet):
     1. Extensions → Apps Script. Paste this whole file in place of what's
        there and click 💾 Save.
     2. Back in the sheet, reload the page. A 🕘 Platform Attendance menu
        appears. Choose "Set up (feed key)…" and paste the feed key (the
        portal's ATTENDANCE_FEED_KEY secret). Allow the permissions Google
        asks for (this sheet, and fetching from the portal).
     3. That's it: it syncs now and then every 15 minutes. "Sync now"
        syncs at any time.
   How it works:
     • Each sync reads the last 14 days from the portal's attendance feed
       (/api/attendance-feed) and adds or updates one row per trainee per day
       (the hidden Key column says which).
     • A row changes only when the platform has a newer update for it, so an
       edit made here stays until someone changes that trainee's day on the
       platform.
     • Rows are sorted newest day first, then program, batch and name, with
       the attendance sheet's status dropdown and colors.
   ============================================================ */
var TAB = 'Platform Attendance';
var FEED_URL = 'https://cm-training-activity.pages.dev/api/attendance-feed';
var FEED_DAYS = 14;
var EVERY_MINUTES = 15;
var HEAD = ['Date', 'Day', 'Program', 'Batch', 'Name', 'Training', 'Time In (PT)', 'Time Out (PT)', 'Status', 'Notes', 'Updated on platform', 'Key'];
var COL = { date: 1, day: 2, program: 3, batch: 4, name: 5, training: 6, timeIn: 7, timeOut: 8, status: 9, note: 10, at: 11, key: 12 };
var STATUSES = [
  ['Present', '#11734b', '#ffffff'], ['Late', '#d4edbc', '#11734b'], ['Late with Notif', '#e6cff2', '#5a3286'],
  ['Early Out - POC Approved', '#ffe5a0', '#473821'], ['Undertime - POC Approved', '#b10202', '#ffffff'],
  ['Undertime - No Approval', '#ffcfc9', '#b10202'], ['NCNS', '#473821', '#ffffff'], ['Sick Leave', '#3d3d3d', '#ffffff'],
  ['RL', '#ffcfc9', '#b10202'], ['EOP', '#bfe1f6', '#0a53a8'], ['Absent with Notif', '#753800', '#ffffff']
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🕘 Platform Attendance')
    .addItem('Sync now', 'syncAttendance')
    .addItem('Set up (feed key)…', 'setUpAttendance')
    .addSeparator()
    .addItem('Turn on auto-sync (every ' + EVERY_MINUTES + ' min)', 'turnOnAutoSync')
    .addItem('Turn off auto-sync', 'turnOffAutoSync')
    .addToUi();
}

function setUpAttendance() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('🕘 Platform Attendance', 'Paste the feed key (the portal’s ATTENDANCE_FEED_KEY):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  PropertiesService.getScriptProperties().setProperty('FEED_KEY', r.getResponseText().trim());
  var n = syncAttendance();
  turnOnAutoSync();
  ui.alert('🕘 Platform Attendance', 'Synced (' + n + ' rows from the platform). It syncs again every ' + EVERY_MINUTES + ' minutes.', ui.ButtonSet.OK);
}

function turnOnAutoSync() {
  turnOffAutoSync();
  ScriptApp.newTrigger('syncAttendance').timeBased().everyMinutes(EVERY_MINUTES).create();
}
function turnOffAutoSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncAttendance') ScriptApp.deleteTrigger(t); });
}

// Reads the feed and merges it into the tab. Returns how many rows the feed had.
function syncAttendance() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('FEED_KEY');
  if (!key) throw new Error('No feed key yet: choose 🕘 Platform Attendance → Set up (feed key)…');
  var res = UrlFetchApp.fetch((props.getProperty('FEED_URL') || FEED_URL) + '?days=' + FEED_DAYS,
    { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  var data = {};
  try { data = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !data.success) throw new Error('The attendance feed said: ' + (data.error || ('HTTP ' + res.getResponseCode())));
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = attendanceTab_();
    SHEET_TZ_ = sh.getParent().getSpreadsheetTimeZone();
    var last = sh.getLastRow();
    var current = last > 1 ? sh.getRange(2, 1, last - 1, HEAD.length).getValues() : [];
    var merged = mergeAttendance(current, data.rows || []);
    if (merged.changed) {
      if (merged.rows.length + 1 > sh.getMaxRows()) { sh.insertRowsAfter(sh.getMaxRows(), merged.rows.length + 1 - sh.getMaxRows() + 200); formatTab_(sh); }
      if (last > 1) sh.getRange(2, 1, last - 1, HEAD.length).clearContent();
      if (merged.rows.length) sh.getRange(2, 1, merged.rows.length, HEAD.length).setValues(merged.rows);
    }
    props.setProperty('LAST_SYNC', new Date().toISOString());
  } finally {
    lock.releaseLock();
  }
  return (data.rows || []).length;
}

/* ---------- the merge (no sheet calls, so it can be tested on its own) ----------
   current: the tab's rows (HEAD order); feed: the feed's rows. A feed row replaces its
   row when it's newer than the tab's "Updated on platform"; a new row is added only once
   something is tagged; rows the feed doesn't mention (older days) stay. */
function mergeAttendance(current, feed) {
  var byKey = {}, rows = current.filter(function (r) { return r[COL.key - 1]; }), changed = rows.length !== current.length;
  rows.forEach(function (r, i) { byKey[r[COL.key - 1]] = i; });
  feed.forEach(function (f) {
    var tagged = !!(f.status || f.timeIn || f.timeOut || f.note);
    var row = [toDate_(f.date), f.day || '', f.programLabel || f.program, f.batch || '', f.name || '', f.training || '',
      time12_(f.timeIn), time12_(f.timeOut), f.status || '', f.note || '', f.at || '', f.id];
    if (byKey.hasOwnProperty(f.id)) {
      var i = byKey[f.id];
      if (String(f.at || '') > String(rows[i][COL.at - 1] || '')) { rows[i] = row; changed = true; }
    } else if (tagged) {
      byKey[f.id] = rows.length; rows.push(row); changed = true;
    }
  });
  var dateOf = function (v) { return v instanceof Date ? v.getTime() : new Date(v).getTime() || 0; };
  var sorted = rows.slice().sort(function (a, b) {
    return dateOf(b[0]) - dateOf(a[0]) || String(a[2]).localeCompare(String(b[2])) || String(a[3]).localeCompare(String(b[3]), undefined, { numeric: true }) || String(a[4]).localeCompare(String(b[4]));
  });
  if (!changed) changed = sorted.some(function (r, i) { return r !== rows[i]; });
  return { rows: sorted, changed: changed };
}
// A day as a date in the spreadsheet's own time zone, so it never shows as the day before.
var SHEET_TZ_ = null;
function toDate_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return SHEET_TZ_ && typeof Utilities !== 'undefined' ? Utilities.parseDate(m[0], SHEET_TZ_, 'yyyy-MM-dd') : new Date(+m[1], +m[2] - 1, +m[3]);
}
function time12_(v) { var m = /^(\d{1,2}):(\d{2})/.exec(String(v || '')); if (!m) return ''; var h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM'); }

// The tab, made the first time: headers, formats, the status dropdown and its colors.
function attendanceTab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB);
  if (sh) return sh;
  sh = ss.insertSheet(TAB);
  sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold').setBackground('#0f2148').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  [95, 50, 190, 80, 170, 230, 95, 95, 180, 260, 170].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.hideColumns(COL.key);
  formatTab_(sh);
  return sh;
}
// Formats, the status dropdown and its colors, down to the tab's last row (again after rows are added).
function formatTab_(sh) {
  var rows = sh.getMaxRows() - 1;
  sh.getRange(2, COL.date, rows, 1).setNumberFormat('mm/dd/yyyy');
  sh.getRange(2, COL.program, rows, COL.key - COL.program + 1).setNumberFormat('@');
  var status = sh.getRange(2, COL.status, rows, 1);
  status.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES.map(function (s) { return s[0]; }), true).setAllowInvalid(true).build());
  sh.setConditionalFormatRules(STATUSES.map(function (s) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(s[0]).setBackground(s[1]).setFontColor(s[2]).setRanges([status]).build();
  }));
}

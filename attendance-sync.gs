/* ============================================================
   LSH Training Portal ⇄ Google Sheet: 🕘 Platform Attendance
   Keeps a "Platform Attendance" tab in this spreadsheet in step with the
   attendance on the platform, both ways, for every program and batch:
     • platform → sheet: each trainee's automatic Time In (recorded when they
       open their course each day) and everything trainers tag in each
       course's Admin → 🕘 Attendance tab or the portal's /attendance.html;
     • sheet → platform: an edit here to Training, Time In, Time Out, Status
       or Notes is sent to the platform straight away.

   Set up (once, by someone who can edit the sheet):
     1. Extensions → Apps Script. Paste this whole file in place of what's
        there and click 💾 Save.
     2. Back in the sheet, reload the page. A 🕘 Platform Attendance menu
        appears. Choose "Set up (feed key)…" and paste the feed key (the
        portal's ATTENDANCE_FEED_KEY secret). Allow the permissions Google
        asks for (this sheet, fetching from the portal, and running on its own).
     3. That's it: it syncs now, then every 15 minutes, and sends edits as
        they're made. "Sync now" syncs at any time.
   How it works:
     • Each sync reads the last 14 days from the portal's attendance feed
       (/api/attendance-feed) and adds or updates one row per trainee per day
       (the hidden Key column says which).
     • A row changes only when the platform has a newer update for it. An edit
       made here is sent to the platform; if it can't be, "Sync note" says why
       and the edit stays here until that trainee's day changes on the platform.
     • Date, Day, Program, Batch and Name come from the platform; change them there.
     • Rows are sorted newest day first, then program, batch and name, with
       the attendance sheet's status dropdown and colors.
   ============================================================ */
var TAB = 'Platform Attendance';
var FEED_URL = 'https://cm-training-activity.pages.dev/api/attendance-feed';
var FEED_DAYS = 14;
var EVERY_MINUTES = 15;
var HEAD = ['Date', 'Day', 'Program', 'Batch', 'Name', 'Training', 'Time In (EST)', 'Time Out (EST)', 'Status', 'Notes', 'Updated on platform', 'Sync note', 'Key'];
var COL = { date: 1, day: 2, program: 3, batch: 4, name: 5, training: 6, timeIn: 7, timeOut: 8, status: 9, note: 10, at: 11, sync: 12, key: 13 };
// The columns an edit here sends to the platform.
var EDITABLE = { 6: 'training', 7: 'timeIn', 8: 'timeOut', 9: 'status', 10: 'note' };
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
    .addItem('Turn on auto-sync (both ways)', 'turnOnAutoSync')
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
  ui.alert('🕘 Platform Attendance', 'Synced (' + n + ' rows from the platform). It syncs again every ' + EVERY_MINUTES +
    ' minutes, and edits made here to Training, Time In, Time Out, Status or Notes go to the platform straight away.', ui.ButtonSet.OK);
}

// Every 15 minutes from the platform, and each edit here to the platform (an installable trigger,
// since a plain onEdit can't reach the portal).
function turnOnAutoSync() {
  turnOffAutoSync();
  ScriptApp.newTrigger('syncAttendance').timeBased().everyMinutes(EVERY_MINUTES).create();
  ScriptApp.newTrigger('pushSheetEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}
function turnOffAutoSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAttendance' || t.getHandlerFunction() === 'pushSheetEdit') ScriptApp.deleteTrigger(t);
  });
}

/* ---------- platform → sheet ---------- */
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

/* ---------- sheet → platform ---------- */
// An edit to Training, Time In, Time Out, Status or Notes on a platform row: sends just those fields.
function pushSheetEdit(e) {
  var range = e && e.range;
  if (!range || range.getSheet().getName() !== TAB) return;
  var sh = range.getSheet(), r1 = Math.max(2, range.getRow()), r2 = range.getLastRow(), cols = [];
  for (var c = range.getColumn(); c <= range.getLastColumn(); c++) if (EDITABLE[c]) cols.push(c);
  if (!cols.length || r2 < r1 || r2 - r1 >= 100) return;
  var props = PropertiesService.getScriptProperties(), key = props.getProperty('FEED_KEY');
  if (!key) return;
  var values = sh.getRange(r1, 1, r2 - r1 + 1, HEAD.length).getValues();   // read now, before anything else writes
  var by = (e.user && e.user.getEmail && e.user.getEmail()) || '';
  var out = values.map(function (row) { return sheetEditRequest(row, cols, by); });
  var sent = out.map(function (req) {
    if (!req || req.error) return req;
    var res = UrlFetchApp.fetch(props.getProperty('FEED_URL') || FEED_URL, { method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key }, payload: JSON.stringify(req.body), muteHttpExceptions: true });
    var data = {};
    try { data = JSON.parse(res.getContentText()); } catch (x) {}
    return res.getResponseCode() === 200 && data.success ? { at: data.at, times: req.times } : { error: data.error || ('HTTP ' + res.getResponseCode()) };
  });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    sent.forEach(function (s, i) {
      if (!s) return;
      var row = r1 + i;
      if (sh.getRange(row, COL.key).getValue() !== values[i][COL.key - 1]) return;   // a sync moved the rows; it brings the change back
      if (s.error) { sh.getRange(row, COL.sync).setValue('⚠ Not sent to the platform: ' + s.error); return; }
      sh.getRange(row, COL.at).setValue(s.at);
      sh.getRange(row, COL.sync).setValue('');
      Object.keys(s.times).forEach(function (col) { sh.getRange(row, +col).setValue(s.times[col]); });   // 8:05 → 8:05 AM
    });
  } finally {
    lock.releaseLock();
  }
}
// The request for one edited row (no sheet calls, so it can be tested on its own):
// { body: { id, batch, name, fields, by }, times: { <column>: '8:05 AM' } }, { error }, or null (not a platform row).
function sheetEditRequest(row, cols, by) {
  var id = String(row[COL.key - 1] || '');
  if (!id) return null;
  var fields = {}, times = {};
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i], f = EDITABLE[c], v = row[c - 1];
    if (f === 'timeIn' || f === 'timeOut') {
      var t = time24_(v);
      if (t === null) return { error: 'write ' + HEAD[c - 1] + ' like 8:05 AM.' };
      fields[f] = t; if (t) times[c] = time12_(t);
    } else fields[f] = String(v == null ? '' : v).trim();
  }
  return { body: { id: id, batch: String(row[COL.batch - 1] || ''), name: String(row[COL.name - 1] || ''), fields: fields, by: by }, times: times };
}
// "8:05 AM", "8:05 pm", "08:05", "20:05" or a time value → "HH:MM"; "" → ""; anything else → null.
function time24_(v) {
  if (isDate_(v)) return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])?\.?\s*[Mm]?\.?$/.exec(s);
  if (!m) return null;
  var h = +m[1], min = +m[2];
  if (min > 59) return null;
  if (m[3]) { if (h < 1 || h > 12) return null; h = h % 12 + (/[Pp]/.test(m[3]) ? 12 : 0); }
  else if (h > 23) return null;
  return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
}

/* ---------- the merge (no sheet calls, so it can be tested on its own) ----------
   current: the tab's rows (HEAD order); feed: the feed's rows. A feed row replaces its
   row when it's newer than the tab's "Updated on platform"; a new row is added once it
   has something (an automatic Time In or a tag); rows the feed doesn't mention (older days) stay. */
function mergeAttendance(current, feed) {
  var byKey = {}, rows = current.filter(function (r) { return r[COL.key - 1]; }), changed = rows.length !== current.length;
  rows.forEach(function (r, i) { byKey[r[COL.key - 1]] = i; });
  feed.forEach(function (f) {
    var tagged = !!(f.status || f.timeIn || f.timeOut || f.note);
    var row = [toDate_(f.date), f.day || '', f.programLabel || f.program, f.batch || '', f.name || '', f.training || '',
      time12_(f.timeIn), time12_(f.timeOut), f.status || '', f.note || '', f.at || '', '', f.id];
    if (byKey.hasOwnProperty(f.id)) {
      var i = byKey[f.id];
      if (String(f.at || '') > String(rows[i][COL.at - 1] || '')) { rows[i] = row; changed = true; }
    } else if (tagged) {
      byKey[f.id] = rows.length; rows.push(row); changed = true;
    }
  });
  var dateOf = function (v) { return isDate_(v) ? v.getTime() : new Date(v).getTime() || 0; };
  var sorted = rows.slice().sort(function (a, b) {
    return dateOf(b[0]) - dateOf(a[0]) || String(a[2]).localeCompare(String(b[2])) || String(a[3]).localeCompare(String(b[3]), undefined, { numeric: true }) || String(a[4]).localeCompare(String(b[4]));
  });
  if (!changed) changed = sorted.some(function (r, i) { return r !== rows[i]; });
  return { rows: sorted, changed: changed };
}
function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
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
  [95, 50, 190, 80, 170, 230, 95, 95, 180, 260, 170, 240].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
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

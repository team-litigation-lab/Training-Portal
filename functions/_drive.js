// Google Drive for archived batches (Admin → Progress & Feedback).
//
// Signs in as a Google Cloud service account (no user login) and writes into a
// folder on a *Shared Drive*: service accounts have no storage of their own,
// so they can't create files in someone's My Drive folder.
//
// Secrets on this Pages project (never in the code):
//   GDRIVE_SA_EMAIL        the service account's email (…@….iam.gserviceaccount.com)
//   GDRIVE_SA_KEY          its private key, the "private_key" value from the JSON key file
//   GDRIVE_ARCHIVE_FOLDER  id of the Shared Drive (or a folder in it) that holds the archives;
//                          the service account must be a Content manager there
// Layout: <root>/LSH Training Archives/<Program>/Batch <batch>/ with a CSV and a JSON per archive.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const ALL = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

export const driveConfigured = (env) => !!(env.GDRIVE_SA_EMAIL && env.GDRIVE_SA_KEY && env.GDRIVE_ARCHIVE_FOLDER);

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(new TextEncoder().encode(s));

async function accessToken(env) {
    const pem = String(env.GDRIVE_SA_KEY).replace(/\\n/g, '\n');
    const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const now = Math.floor(Date.now() / 1000);
    const unsigned = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64urlText(JSON.stringify({
        iss: env.GDRIVE_SA_EMAIL, scope: 'https://www.googleapis.com/auth/drive', aud: TOKEN_URL, iat: now, exp: now + 3600
    }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + unsigned + '.' + b64url(sig) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw new Error('Google sign-in failed: ' + (j.error_description || j.error || res.status));
    return j.access_token;
}

async function call(token, url, init = {}) {
    const res = await fetch(url, { ...init, headers: { Authorization: 'Bearer ' + token, ...(init.headers || {}) } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Google Drive: ' + ((j.error && j.error.message) || res.status));
    return j;
}

async function folder(token, name, parent) {
    const q = encodeURIComponent(`name = '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`);
    const found = await call(token, `${API}?q=${q}&fields=files(id,webViewLink)&pageSize=1&${ALL}`);
    if (found.files && found.files[0]) return found.files[0];
    return call(token, `${API}?fields=id,webViewLink&supportsAllDrives=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] })
    });
}

async function upload(token, name, mime, content, parent) {
    const boundary = 'lsh' + crypto.randomUUID().replace(/-/g, '');
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n` +
        `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
    return call(token, `${UPLOAD}?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body
    });
}

const csvq = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
export function batchCsv(programLabel, batch, trainees) {
    const head = ['Name', 'Program', 'Batch', 'Status', 'Days done', 'Days total', 'Knowledge Check avg', 'Practice avg', 'Practice done',
        'Random task avg', 'Roleplay avg', 'Trainer feedback sent', 'Trainer feedback drafts', 'Latest trainer rating', 'Last active', 'Registered'];
    const rows = trainees.map(t => { const fb = t.feedback || {};
        return [t.name, programLabel, batch, t.status, t.daysDone, t.daysTotal, t.kcAvg, t.practiceAvg, t.practiceDone, t.taskAvg, t.roleplayAvg,
            fb.sent || 0, fb.drafts || 0, fb.latestRating || '', t.lastActive, t.registeredAt].map(csvq).join(','); });
    return [head.map(csvq).join(',')].concat(rows).join('\r\n');
}

// Saves one archived batch; returns the batch folder's link.
export async function saveBatchToDrive(env, { programLabel, batch, trainees, archivedBy }) {
    const token = await accessToken(env);
    const root = await folder(token, 'LSH Training Archives', env.GDRIVE_ARCHIVE_FOLDER);
    const prog = await folder(token, programLabel, root.id);
    const dir = await folder(token, `Batch ${batch}`, prog.id);
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
    const base = `${programLabel} — Batch ${batch} — archived ${stamp}`;
    await upload(token, base + '.csv', 'text/csv', batchCsv(programLabel, batch, trainees), dir.id);
    await upload(token, base + '.json', 'application/json',
        JSON.stringify({ program: programLabel, batch, archivedAt: new Date().toISOString(), archivedBy, trainees }, null, 1), dir.id);
    return dir.webViewLink || `https://drive.google.com/drive/folders/${dir.id}`;
}

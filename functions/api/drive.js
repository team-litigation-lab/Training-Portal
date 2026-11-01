import { json, requireSession } from '../_utils.js';
import { ensureSimResultsTable } from './call-results.js';
import { toCourseFor } from './sim-results.js';

/* ============================================================
   📂 The trainee's Backup Drive (simulators/drive.html, simulators/drive.js, POST /api/drive)

   The Case Management course's Backup Drive (Case-Management-Training worker.js /api/drive, js/cm-drive.js),
   on the Portal, for every program: the same structure, the same grading, the same Google set-up and the
   same secrets. A firm keeps a backup drive of every case document in one folder structure everybody knows
   by heart: a Case Manager covering someone else's file still finds the executed retainer, the demand
   package and the lien correspondence where they always are. A trainee practises that on their own Google
   Drive: they connect it once, lay the firm's structure out themselves — graded, folder by folder — and the
   structure is then made in their Drive. ↻ Check my drive and 🔁 Put the missing folders back keep it.

   AUTOMATED SCORING: every graded setup is also saved as a simulator result, "Backup Drive Setup"
   (simulator_results, the same table the other simulators use), so the score reaches Admin → Progress and
   the Simulators page's results, and — when the page was opened from a course (?program=CM|FT|PD|EA) — that
   course's own store (<prefix>simresults:<course trainee id>), like every other Portal simulator.

   The standard lives here and nowhere else: the page draws from what this sends and never carries a copy.
   Paths are "/"-separated and in order; a trainee's layout is right when it is the same list, in the same
   order, spelled the same way.

   Google: only drive.file, so this can see and change the folders and files it made and nothing else in
   the trainee's Drive. Tokens are sealed (AES-GCM) under a key derived from SESSION_SECRET and kept in
   TRAINING_DB.drive_backups (made on first use); they never leave this Function. Secrets, as on the CM
   Worker: GOOGLE_CLIENT_ID (a plain variable) and GOOGLE_CLIENT_SECRET (a secret) on this Pages project,
   with the Google Drive API on in that Google Cloud project, the drive.file scope on its OAuth consent
   screen and this site among the OAuth client's Authorized JavaScript origins. The CM course's client can
   be used as it is (add this site's origin to it). Until both are set, the page says the Backup Drive
   isn't switched on and nothing else is blocked.

   POST { action }:
     status                  the trainee's drive (never a token)
     connect { code }        Google's popup code → sealed tokens
     disconnect              gives the access back; the setup, its grade and the saved list are kept
     setup { layout, program } the graded Day 1 setup; built in their Drive when it is right
     check                   which folders are no longer in their Drive
     rebuild                 makes the missing folders again
     put { docFolder|folder, name, mime, b64 }  a filed document, kept in its folder on the drive
     report { traineeId }    (trainers) one trainee's report
     reportAll { traineeIds? } (trainers) every trainee with a drive record
     checkFor { traineeId }  (trainers) refresh a trainee's folder check, read-only
   ============================================================ */
const DRIVE_ROOT = 'LSH Case Backups';
const DRIVE_SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
const DRIVE_MAX_BYTES = 4 * 1024 * 1024;
const SIMULATOR = 'Backup Drive Setup';

/* The firm's structure, in the order it is read (the CM course's FOLDER_STANDARD, unchanged). The client
   folder is the case the courses run (John Doe), named last name first so a drive of clients sorts by surname. */
export const CLIENT_FOLDER = '01 Clients/Doe-John';
export const FOLDER_STANDARD = [
    '01 Clients',
    CLIENT_FOLDER,
    `${CLIENT_FOLDER}/01 Intake & Retainer`,
    `${CLIENT_FOLDER}/02 Police, Witness & Video`,
    `${CLIENT_FOLDER}/03 Medical Records`,
    `${CLIENT_FOLDER}/04 Bills & Invoices`,
    `${CLIENT_FOLDER}/05 Insurance, Demands & Negotiation`,
    `${CLIENT_FOLDER}/06 Liens & Reimbursement`,
    `${CLIENT_FOLDER}/07 Wages & Costs`,
    `${CLIENT_FOLDER}/08 Property Damage`,
    `${CLIENT_FOLDER}/09 Litigation & ADR`,
    '02 Firm Administration',
    '02 Firm Administration/01 Policies & SOPs',
    '02 Firm Administration/02 Compliance & CLE',
    '03 Templates',
    '04 Closed Files',
];
/* Why each folder is there, so a setup that misses one is told the rule and not just the answer. */
export const FOLDER_WHY = {
    '01 Clients': 'Client work comes first and is numbered first: a drive is read top to bottom under pressure.',
    [CLIENT_FOLDER]: 'A client folder is named last name first, so the clients sort by surname.',
    [`${CLIENT_FOLDER}/01 Intake & Retainer`]: 'The intake sheet, the signed retainer and the authorizations — what proves the firm represents him.',
    [`${CLIENT_FOLDER}/02 Police, Witness & Video`]: 'The crash itself: the report, the witnesses and anything recorded.',
    [`${CLIENT_FOLDER}/03 Medical Records`]: 'The records, kept apart from the bills, because liability reads the records and damages read the bills.',
    [`${CLIENT_FOLDER}/04 Bills & Invoices`]: 'The billed amounts, which the demand adds up and an adjuster checks line by line.',
    [`${CLIENT_FOLDER}/05 Insurance, Demands & Negotiation`]: 'Coverage, the demand package and every offer and counter, in order.',
    [`${CLIENT_FOLDER}/06 Liens & Reimbursement`]: 'Health plan, provider and statutory liens: what has to come off the top before he is paid.',
    [`${CLIENT_FOLDER}/07 Wages & Costs`]: 'Lost wages and the firm\'s costs — the other half of the net sheet.',
    [`${CLIENT_FOLDER}/08 Property Damage`]: 'The vehicle claim, which settles on its own track and must never be mixed into the injury file.',
    [`${CLIENT_FOLDER}/09 Litigation & ADR`]: 'Filings, discovery, orders and mediation, where counsel looks for them in a hurry.',
    '02 Firm Administration': 'The firm\'s own paperwork never sits inside a client\'s folder.',
    '02 Firm Administration/01 Policies & SOPs': 'The procedures the desk runs on.',
    '02 Firm Administration/02 Compliance & CLE': 'Compliance records and anything an auditor asks for.',
    '03 Templates': 'Blank templates, so nobody edits a client\'s copy by mistake.',
    '04 Closed Files': 'Disbursed and closed matters, moved out of the live folders but never deleted.',
};
/* The courses' document folders (the CM course's CM_CF_DOC_FOLDERS ids), and each one's folder on the drive. */
export const DRIVE_HOMES = {
    intake: `${CLIENT_FOLDER}/01 Intake & Retainer`,
    police: `${CLIENT_FOLDER}/02 Police, Witness & Video`,
    medical: `${CLIENT_FOLDER}/03 Medical Records`,
    bills: `${CLIENT_FOLDER}/04 Bills & Invoices`,
    insurance: `${CLIENT_FOLDER}/05 Insurance, Demands & Negotiation`,
    liens: `${CLIENT_FOLDER}/06 Liens & Reimbursement`,
    settlement: `${CLIENT_FOLDER}/07 Wages & Costs`,
    property: `${CLIENT_FOLDER}/08 Property Damage`,
    litigation: `${CLIENT_FOLDER}/09 Litigation & ADR`,
};

const enc = new TextEncoder();
const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
function unb64url(str) {
    str = String(str || '').replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '=';
    const bin = atob(str), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
async function driveSealKey(env) {
    if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not configured, so Google tokens can\'t be stored safely.');
    const raw = await crypto.subtle.digest('SHA-256', enc.encode('lsh-portal-drive-token|' + env.SESSION_SECRET));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(env, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await driveSealKey(env), enc.encode(String(text)));
    return `${b64url(iv)}.${b64url(new Uint8Array(ct))}`;
}
async function unseal(env, sealed) {
    const [iv, ct] = String(sealed || '').split('.');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(iv) }, await driveSealKey(env), unb64url(ct));
    return new TextDecoder().decode(pt);
}

export const driveConfigured = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
async function ensure(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS drive_backups (username TEXT PRIMARY KEY, rec TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
}
async function driveRead(env, id) {
    const r = await env.TRAINING_DB.prepare(`SELECT rec FROM drive_backups WHERE username = ?`).bind(id).first();
    try { return r ? JSON.parse(r.rec) : null; } catch (e) { return null; }
}
async function driveWrite(env, id, rec) {
    await env.TRAINING_DB.prepare(`INSERT INTO drive_backups (username, rec, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET rec = excluded.rec, updated_at = excluded.updated_at`).bind(id, JSON.stringify(rec), new Date().toISOString()).run();
    return rec;
}
const driveDelete = (env, id) => env.TRAINING_DB.prepare(`DELETE FROM drive_backups WHERE username = ?`).bind(id).run();

async function googleToken(params) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
    });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
}
/* A live access token for this trainee, refreshed and saved when it is about to run out. */
async function driveAccess(env, id, rec, force = false) {
    if (!force && rec.access && Number(rec.exp) > Date.now() + 60000) return unseal(env, rec.access);
    const { ok, data } = await googleToken({
        client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: await unseal(env, rec.refresh), grant_type: 'refresh_token',
    });
    if (!ok) {
        if (data.error === 'invalid_grant') {
            // The Google link is gone; the trainee's record (the setup and its grade) stays.
            delete rec.refresh; delete rec.access; delete rec.exp; delete rec.email;
            await driveWrite(env, id, rec);
            const e = new Error('The Google Drive connection has expired or was taken back. Connect the Backup Drive again.'); e.code = 'DRIVE_RECONNECT'; throw e;
        }
        throw new Error(`Google refused to refresh access: ${data.error_description || data.error || 'unknown error'}`);
    }
    rec.access = await seal(env, data.access_token);
    rec.exp = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    await driveWrite(env, id, rec);
    return data.access_token;
}
/* One Drive call, tried again once with a fresh token if Google says this one is stale. */
async function drive(env, id, rec, method, url, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const token = await driveAccess(env, id, rec, attempt > 0);
        const headers = { Authorization: `Bearer ${token}` };
        let payload;
        if (body && body.raw !== undefined) { headers['Content-Type'] = body.type; payload = body.raw; }
        else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
        const r = await fetch(url.startsWith('https://') ? url : DRIVE_API + url, { method, headers, body: payload });
        if (r.status === 401 && attempt === 0) continue;
        return { ok: r.ok, status: r.status, data: r.status === 204 ? {} : await r.json().catch(() => ({})) };
    }
}
const driveMessage = (res) => (res && res.data && res.data.error && res.data.error.message) || `Google Drive error ${res ? res.status : ''}`.trim();

async function folderLives(env, id, rec, fid) {
    if (!fid) return false;
    const res = await drive(env, id, rec, 'GET', `/files/${encodeURIComponent(fid)}?fields=id,trashed`);
    return !!(res.ok && !res.data.trashed);
}
async function makeFolder(env, id, rec, name, parent) {
    const res = await drive(env, id, rec, 'POST', '/files?fields=id', { name, mimeType: FOLDER_MIME, parents: parent ? [parent] : undefined });
    if (!res.ok || !res.data.id) throw new Error(driveMessage(res));
    return res.data.id;
}
/* The whole structure, made (or made again) in the trainee's Drive. Only what is missing is created, so
   running it twice costs nothing and a folder deleted in Drive comes back where it was. */
async function driveBuild(env, id, rec) {
    rec.folders = rec.folders || {};
    const made = [], restored = [];
    if (!(await folderLives(env, id, rec, rec.rootId))) {
        rec.rootId = await makeFolder(env, id, rec, DRIVE_ROOT);
        rec.folders = {};                                  // a new root means every folder under it is new
        made.push(DRIVE_ROOT);
    }
    for (const path of FOLDER_STANDARD) {
        const had = rec.folders[path];
        if (had && (await folderLives(env, id, rec, had))) continue;
        const cut = path.lastIndexOf('/');
        const parent = cut < 0 ? rec.rootId : rec.folders[path.slice(0, cut)];
        rec.folders[path] = await makeFolder(env, id, rec, path.slice(cut + 1), parent || rec.rootId);
        (had ? restored : made).push(path);
    }
    rec.builtAt = new Date().toISOString();
    if (restored.length) rec.restoredCount = (Number(rec.restoredCount) || 0) + restored.length;
    rec.lastMissing = [];
    await driveWrite(env, id, rec);
    return { made, restored };
}
/* Which of the structure's folders are no longer in the trainee's Drive. Keeping the drive is part of the
   job, so a folder someone deleted is reported rather than quietly made again. */
async function driveVerify(env, id, rec) {
    const missing = [];
    if (!(await folderLives(env, id, rec, rec.rootId))) {
        rec.checkedAt = new Date().toISOString();
        rec.lastMissing = FOLDER_STANDARD.slice();
        await driveWrite(env, id, rec);
        return { missing: [DRIVE_ROOT].concat(FOLDER_STANDARD), rootGone: true };
    }
    for (const path of FOLDER_STANDARD) if (!(await folderLives(env, id, rec, rec.folders && rec.folders[path]))) missing.push(path);
    rec.checkedAt = new Date().toISOString();
    rec.lastMissing = missing;
    await driveWrite(env, id, rec);
    return { missing, rootGone: false };
}

/* Day 1 setup, graded: the layout the trainee typed against the firm's standard, in order. */
export function gradeLayout(layout) {
    const want = FOLDER_STANDARD;
    const got = (Array.isArray(layout) ? layout : []).map((s) => String(s || '').trim().replace(/^\/+|\/+$/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const problems = [], norm = (s) => s.toLowerCase();
    want.forEach((w) => {
        if (got.some((g) => g === w)) return;
        const near = got.find((g) => norm(g) === norm(w));
        if (near) problems.push(`"${near}" is spelled differently from the firm's "${w}" — a drive everybody shares is spelled one way. ${FOLDER_WHY[w] || ''}`.trim());
        else problems.push(`"${w}" is missing. ${FOLDER_WHY[w] || ''}`.trim());
    });
    got.forEach((g) => { if (!want.includes(g)) problems.push(`"${g}" isn't part of the firm's structure. A folder somebody invented is a folder nobody else looks in.`); });
    if (!problems.length) {
        const order = got.filter((g) => want.includes(g));
        for (let i = 0; i < order.length; i++) if (order[i] !== want[i]) { problems.push(`The folders are right but out of order: "${want[i]}" comes before "${order[i]}". The numbers follow the case from intake to close, which is how every drive in the firm reads.`); break; }
    }
    const score = Math.max(0, Math.round(((want.length - Math.min(problems.length, want.length)) / want.length) * 100));
    return { ok: !problems.length, problems, score, standard: want };
}

/* What the page is told about a trainee's Backup Drive. Never a token, sealed or not. */
function driveStatus(env, rec) {
    const configured = driveConfigured(env);
    return {
        configured,
        clientId: configured ? env.GOOGLE_CLIENT_ID : '',
        scopes: DRIVE_SCOPES,
        standard: FOLDER_STANDARD,
        why: FOLDER_WHY,
        homes: DRIVE_HOMES,
        root: DRIVE_ROOT,
        connected: !!(rec && rec.refresh),
        email: (rec && rec.refresh && rec.email) || '',
        rootUrl: rec && rec.rootId ? `https://drive.google.com/drive/folders/${encodeURIComponent(rec.rootId)}` : '',
        built: !!(rec && rec.builtAt),
        builtAt: (rec && rec.builtAt) || null,
        checkedAt: (rec && rec.checkedAt) || null,
        lastMissing: (rec && rec.lastMissing) || [],
        setup: (rec && rec.setup) || null,
        saved: ((rec && rec.saved) || []).map((s) => ({ name: s.name, folder: s.folder, at: s.at })),
    };
}
/* What a trainer reads: connected, the graded setup and how it was reached, the last check, and the filed
   documents copied per folder. Never a token, sealed or not. */
function driveReport(id, rec, who) {
    const saved = (rec && rec.saved) || [];
    const perFolder = {};
    let lastCopyAt = null;
    saved.forEach((s) => { perFolder[s.folder] = (perFolder[s.folder] || 0) + 1; if (!lastCopyAt || s.at > lastCopyAt) lastCopyAt = s.at; });
    const setup = (rec && rec.setup) || null;
    const tries = (rec && rec.tries) || (setup ? [{ at: setup.at, ok: !!setup.ok, n: (setup.problems || []).length }] : []);
    return {
        traineeId: id,
        name: (who && who.name) || '',
        batch: (who && who.batch) || '',
        connected: !!(rec && rec.refresh),
        email: (rec && rec.refresh && rec.email) || '',
        connectedAt: (rec && rec.connectedAt) || null,
        attempts: (setup && setup.attempts) || 0,
        passed: !!(setup && setup.ok),
        score: setup ? setup.score : null,
        tries,
        problems: (setup && setup.problems) || [],
        builtAt: (rec && rec.builtAt) || null,
        checkedAt: (rec && rec.checkedAt) || null,
        missing: (rec && rec.lastMissing) || [],
        restored: Number(rec && rec.restoredCount) || 0,
        copies: saved.length,
        perFolder,
        lastCopyAt,
        standard: FOLDER_STANDARD.length,
    };
}
async function namesOf(env, ids) {
    const who = {};
    try {
        for (let i = 0; i < ids.length && env.DB; i += 90) {
            const part = ids.slice(i, i + 90);
            const { results } = await env.DB.prepare(`SELECT username, first_name, last_name, batch_id FROM users WHERE username IN (${part.map(() => '?').join(', ')})`).bind(...part).all();
            (results || []).forEach((u) => { who[u.username] = { name: [u.first_name, u.last_name].filter(Boolean).join(' '), batch: u.batch_id || '' }; });
        }
    } catch (e) { /* names are a convenience: the report still shows usernames */ }
    return who;
}

/* The automated score: each graded setup is a simulator result, like every other Portal simulator, and goes
   to the trainee's course when the page was opened from one. A failure here never fails the setup. */
async function recordScore(env, session, grade, attempts, program) {
    const at = new Date().toISOString();
    const summary = grade.ok ? `Built right${attempts > 1 ? ` on attempt ${attempts}` : ' first time'}.`
        : `${grade.problems.length} thing${grade.problems.length === 1 ? '' : 's'} to fix (attempt ${attempts}).`;
    try {
        await ensureSimResultsTable(env.TRAINING_DB);
        await env.TRAINING_DB.prepare(`INSERT INTO simulator_results (username, full_name, simulator, scenario, score, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(session.username, session.fullName || session.username, SIMULATOR, 'Firm folder structure', grade.score, summary,
                JSON.stringify({ ok: grade.ok, attempts, problems: grade.problems.slice(0, 20), program: program || '' }), at).run();
    } catch (e) { /* the grade is kept on the drive record either way */ }
    if (program) { try { await toCourseFor(env, session.username, program, { simulator: SIMULATOR, scenario: 'Firm folder structure', score: grade.score, at }); } catch (e) { /* best effort */ } }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const s = auth.session, admin = s.userType === 'Admin';
    let b;
    try { b = await request.json(); } catch (e) { b = {}; }
    b = b && typeof b === 'object' ? b : {};
    const action = String(b.action || 'status');
    await ensure(env.TRAINING_DB);

    if (['report', 'reportAll', 'checkFor'].includes(action) && !admin) return json({ error: 'Only a trainer can read the Backup Drive report.' }, 403);
    if (action === 'reportAll') {
        let ids = Array.isArray(b.traineeIds) ? b.traineeIds.filter((x) => typeof x === 'string').map((x) => x.slice(0, 120)).slice(0, 500) : null;
        if (!ids) {
            const { results } = await env.TRAINING_DB.prepare(`SELECT username FROM drive_backups ORDER BY updated_at DESC LIMIT 2000`).all();
            ids = (results || []).map((r) => r.username);
        }
        const who = await namesOf(env, ids);
        const reports = {};
        for (const id of ids) reports[id] = driveReport(id, await driveRead(env, id), who[id]);
        return json({ reports, configured: driveConfigured(env), standard: FOLDER_STANDARD.length });
    }
    // A trainer reads a trainee's; a trainee works on their own. An admin has no drive of their own here.
    const mine = admin ? '' : s.username;
    const who = mine || (admin && typeof b.traineeId === 'string' ? b.traineeId.slice(0, 120) : '');
    if (!who) return json({ error: 'Sign in as a trainee to use the Backup Drive.', code: 'DRIVE_NOT_A_TRAINEE' }, 403);
    if (action === 'report') return json({ report: driveReport(who, await driveRead(env, who), (await namesOf(env, [who]))[who]) });
    if (!mine && action !== 'status' && action !== 'checkFor') return json({ error: 'A trainer can read a trainee\'s Backup Drive, not change it.' }, 403);
    if (!driveConfigured(env)) return json({ drive: driveStatus(env, null) });
    let rec = await driveRead(env, who);
    try {
        if (action === 'status') return json({ drive: driveStatus(env, rec) });
        if (action === 'connect') {
            const code = String(b.code || '');
            if (!code) return json({ error: 'Google sign-in didn\'t finish.' }, 400);
            const { ok, data } = await googleToken({
                code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: 'postmessage', grant_type: 'authorization_code',
            });
            if (!ok) return json({ error: `Google sign-in failed: ${data.error_description || data.error || 'unknown error'}` }, 400);
            let email = '';
            try { email = JSON.parse(new TextDecoder().decode(unb64url(String(data.id_token || '').split('.')[1] || ''))).email || ''; } catch (e) { /* no id token */ }
            // Google sends a refresh token only the first time an account says yes; keep the one we hold otherwise.
            const refresh = data.refresh_token ? await seal(env, data.refresh_token) : (rec && rec.refresh);
            if (!refresh) return json({ error: 'Google didn\'t send long-term access. Remove this site under your Google account\'s third-party access and connect again.' }, 400);
            rec = Object.assign({}, rec, {
                email, refresh, access: data.access_token ? await seal(env, data.access_token) : null,
                exp: Date.now() + (Number(data.expires_in) || 3600) * 1000,
                connectedAt: (rec && rec.connectedAt) || new Date().toISOString(),
            });
            await driveWrite(env, who, rec);
            return json({ drive: driveStatus(env, rec) });
        }
        if (action === 'disconnect') {
            if (rec && rec.refresh) {
                // best effort: give the access back. The copies already in their Drive stay there.
                try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: await unseal(env, rec.refresh) }).toString() }); } catch (e) { /* best effort */ }
            }
            // The Day 1 setup and its grade are the trainee's record and are kept: only the Google link goes.
            const kept = {};
            if (rec) ['setup', 'saved', 'tries', 'restoredCount', 'connectedAt'].forEach((k) => { if (rec[k] !== undefined) kept[k] = rec[k]; });
            rec = Object.keys(kept).length ? kept : null;
            if (rec) await driveWrite(env, who, rec); else await driveDelete(env, who);
            return json({ drive: driveStatus(env, rec) });
        }
        if (!rec || !rec.refresh) return json({ error: 'No Backup Drive is connected yet.', code: 'DRIVE_NOT_CONNECTED' }, 400);

        if (action === 'setup') {
            // Day 1: the structure the trainee laid out, graded against the firm's standard, then made in their Drive.
            const grade = gradeLayout(b.layout);
            const before = (rec.setup && rec.setup.attempts) || 0;
            rec.setup = { attempts: before + 1, at: new Date().toISOString(), score: grade.score, ok: grade.ok, problems: grade.problems };
            rec.tries = (rec.tries || []).concat([{ at: rec.setup.at, ok: grade.ok, n: grade.problems.length, score: grade.score }]).slice(-20);
            await driveWrite(env, who, rec);
            await recordScore(env, s, grade, rec.setup.attempts, String(b.program || '').slice(0, 12));
            if (!grade.ok) return json({ graded: grade, drive: driveStatus(env, rec) });
            const built = await driveBuild(env, who, rec);
            return json({ graded: grade, built, drive: driveStatus(env, rec) });
        }
        if (action === 'checkFor') {
            // A trainer refreshes the last check with the trainee's own (sealed) access: read-only, nothing is made again.
            if (!rec.builtAt) return json({ error: 'This trainee hasn\'t built the structure yet.', report: driveReport(who, rec) }, 400);
            const out = await driveVerify(env, who, rec);
            return json({ verified: out, report: driveReport(who, rec, (await namesOf(env, [who]))[who]) });
        }
        if (action === 'check') {
            const out = await driveVerify(env, who, rec);
            return json({ verified: out, drive: driveStatus(env, rec) });
        }
        if (action === 'rebuild') {
            const built = await driveBuild(env, who, rec);
            return json({ built, drive: driveStatus(env, rec) });
        }
        if (action === 'put') {
            // A filed document, kept in its folder on the backup drive too. The course's own folder id decides where.
            const folder = DRIVE_HOMES[String(b.docFolder || '')] || String(b.folder || '');
            if (!FOLDER_STANDARD.includes(folder)) return json({ error: `"${b.docFolder || b.folder}" has no folder in the firm's structure.` }, 400);
            if (!rec.folders || !rec.folders[folder]) return json({ error: 'That folder isn\'t in your Drive yet. Run the Day 1 setup first.' }, 400);
            const name = String(b.name || '').slice(0, 200);
            if (!name || /[^A-Za-z0-9._-]/.test(name)) return json({ error: 'The file name may hold only letters, digits and - _ .' }, 400);
            let bytes;
            try { bytes = unb64url(b.b64); } catch (e) { return json({ error: 'The document didn\'t arrive. Try again.' }, 400); }
            if (!bytes.length || bytes.length > DRIVE_MAX_BYTES) return json({ error: 'The document is empty or larger than 4 MB.' }, 400);
            if (!(await folderLives(env, who, rec, rec.folders[folder]))) await driveBuild(env, who, rec);
            const boundary = 'lsh' + crypto.randomUUID().replace(/-/g, '');
            const meta = JSON.stringify({ name, parents: [rec.folders[folder]], description: 'Filed from the Legal Skills Hub.' });
            const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${String(b.mime || 'application/pdf').replace(/[^\w.+/-]/g, '').slice(0, 100) || 'application/pdf'}\r\n\r\n`);
            const tail = enc.encode(`\r\n--${boundary}--`);
            const raw = new Uint8Array(head.length + bytes.length + tail.length);
            raw.set(head, 0); raw.set(bytes, head.length); raw.set(tail, head.length + bytes.length);
            const res = await drive(env, who, rec, 'POST', DRIVE_UPLOAD, { raw, type: `multipart/related; boundary=${boundary}` });
            if (!res.ok || !res.data.id) return json({ error: driveMessage(res) }, 502);
            rec.saved = (rec.saved || []).filter((x) => x.name !== name).concat([{ name, folder, at: new Date().toISOString(), id: res.data.id }]).slice(-200);
            await driveWrite(env, who, rec);
            return json({ saved: { name, folder, url: res.data.webViewLink || '' }, drive: driveStatus(env, rec) });
        }
        return json({ error: 'Unknown Backup Drive action.' }, 400);
    } catch (e) {
        return json({ error: (e && e.message) || 'The Backup Drive request failed.', code: (e && e.code) || 'DRIVE_ERROR' }, 502);
    }
}

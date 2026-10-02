import { json, getCookie, createSessionToken, verifySessionToken, requireSession, getSiteState } from './_utils.js';

// Knowledge Base (/kb.html) shared helpers.
//
// Who can read it: VAs who entered the team access code (an admin sets and
// changes it on the Knowledge Base's admin side), and signed-in admins.
// Entering the code gives the browser a signed `lsh_kb` cookie holding the
// VA's name and batch. Changing the code signs everyone out, because each
// cookie carries the code version it was issued for.
//
// Tables (D1 TRAINING_DB, created on first use):
//   kb_settings  key/value: access code hash and version
//   kb_articles  VA posts and admin-written articles
//   kb_comments  "add your experience" replies on an article
//   kb_stats     views and "helpful" counts per article or SOP
//   kb_votes     one "helpful" per person per article
//   kb_rate      per-connection limits for the code and for posting
//   kb_profiles  contributor profiles (a VA's changes wait for an admin, like posts)
// Everything is addressed by a ref: "a:<id>" for posts, "s:<slug>" for SOPs.
// Official SOPs and resources live in the repository under /kb-files/
// (library.json + a Markdown page and the original file for each), served
// only to readers with access by functions/kb-files/[[path]].js.

export const KB_CATEGORIES = [
    'Case Management', 'EA / PA', 'Intake & Client Communication', 'Medical Records & Billing', 'Demands & Negotiation',
    'Liens & Subrogation', 'Litigation & Discovery', 'Calendaring & Docketing', 'Mass Tort', 'Family Law', 'Immigration Law',
    'Estate Planning', 'Business Law', 'Real Estate & Property', 'Tools & Systems', 'Productivity & Soft Skills', 'General'
];
export const KB_TYPES = ['Tip', 'How-to guide', 'Checklist', 'Template', 'Lesson learned', 'Question'];

const COOKIE = 'lsh_kb';
const COOKIE_DAYS = 30;

export const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
export const oneLine = (v, n) => clean(v, n * 2).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export const personKey = (name, batch) => (oneLine(name, 80) + '|' + oneLine(batch, 40)).toLowerCase();

let ensured = false;   // once per worker instance
export async function ensureKbTables(db) {
    const stmts = [
        `CREATE TABLE IF NOT EXISTS kb_settings (key TEXT PRIMARY KEY, value TEXT)`,
        `CREATE TABLE IF NOT EXISTS kb_articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, summary TEXT, body TEXT NOT NULL,
            tags TEXT, link_url TEXT,
            author_name TEXT NOT NULL, author_batch TEXT, author_key TEXT NOT NULL, by_admin INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending', featured INTEGER DEFAULT 0,
            review_note TEXT, reviewed_by TEXT, reviewed_at TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL, ip TEXT)`,
        `CREATE INDEX IF NOT EXISTS kb_articles_status ON kb_articles (status)`,
        `CREATE TABLE IF NOT EXISTS kb_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT, article_ref TEXT NOT NULL, body TEXT NOT NULL,
            author_name TEXT NOT NULL, author_batch TEXT, author_key TEXT NOT NULL, by_admin INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending', review_note TEXT, reviewed_by TEXT, reviewed_at TEXT,
            created_at TEXT NOT NULL, ip TEXT)`,
        `CREATE INDEX IF NOT EXISTS kb_comments_ref ON kb_comments (article_ref, status)`,
        `CREATE TABLE IF NOT EXISTS kb_stats (article_ref TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0, helpful INTEGER NOT NULL DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS kb_votes (article_ref TEXT NOT NULL, voter TEXT NOT NULL, created_at TEXT, PRIMARY KEY (article_ref, voter))`,
        `CREATE TABLE IF NOT EXISTS kb_rate (ip TEXT NOT NULL, kind TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip, kind, bucket))`,
        `CREATE TABLE IF NOT EXISTS kb_profiles (
            person_key TEXT PRIMARY KEY, name TEXT NOT NULL, batch TEXT,
            profile TEXT, pending TEXT, pending_at TEXT, review_note TEXT,
            hidden INTEGER DEFAULT 0, updated_at TEXT, reviewed_by TEXT, reviewed_at TEXT)`
    ];
    if (ensured) return;
    for (const s of stmts) await db.prepare(s).run();
    // Columns added after the first release.
    for (const alter of [`ALTER TABLE kb_articles ADD COLUMN credits TEXT`]) {
        try { await db.prepare(alter).run(); } catch (e) { /* already there */ }
    }
    ensured = true;
}

export async function getSetting(db, key) {
    const row = await db.prepare(`SELECT value FROM kb_settings WHERE key = ?`).bind(key).first();
    return row ? row.value : null;
}
export async function setSetting(db, key, value) {
    await db.prepare(`INSERT INTO kb_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, value).run();
}

// A signed-in admin (their normal portal session), or null. Never answers
// with an error: a missing or expired admin session just means "not admin".
export async function adminSession(request, env) {
    if (!getCookie(request, 'lsh_session')) return null;
    const auth = await requireSession(request, env, { adminOnly: true });
    return auth.ok ? auth.session : null;
}

// Who is asking: { admin, who:{name,batch,key} } or null (no access).
export async function kbReader(request, env) {
    const admin = await adminSession(request, env);
    if (admin) {
        const name = oneLine(admin.fullName || admin.username, 80) || 'Admin';
        return { admin: true, adminUser: admin.username, who: { name, batch: 'Admin', key: 'admin|' + String(admin.username).toLowerCase() } };
    }
    // Everyone else comes in through the Portal: any signed-in, approved Portal user may read. The old shared
    // team access code (and its cookie) no longer opens anything, so nobody outside LSH can get in with it.
    if (!getCookie(request, 'lsh_session')) return null;
    const auth = await requireSession(request, env);
    if (!auth.ok) return null;
    const s = auth.session;
    const name = oneLine(s.fullName || s.username, 80) || 'Trainee';
    const batch = oneLine(s.batchId || '', 40);
    return { admin: false, who: { name, batch, key: personKey(name, batch) } };
}

export async function issueReaderCookie(env, name, batch, version) {
    const token = await createSessionToken({ kb: 1, name, batch, v: version }, env.SESSION_SECRET, COOKIE_DAYS * 86400);
    return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_DAYS * 86400}`;
}
export const clearReaderCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

// Writes must come from the portal's own pages.
export function sameOrigin(request) {
    const origin = request.headers.get('Origin');
    if (!origin) return request.headers.get('Sec-Fetch-Site') !== 'cross-site';
    try { return new URL(origin).host === new URL(request.url).host; } catch (e) { return false; }
}

// Per-connection limit: `limit` hits of `kind` per 10 minutes. Returns true when over.
export async function overLimit(request, db, kind, limit) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = Math.floor(Date.now() / 600000);
    try {
        await db.prepare(`INSERT INTO kb_rate (ip, kind, bucket, hits) VALUES (?, ?, ?, 1)
            ON CONFLICT(ip, kind, bucket) DO UPDATE SET hits = hits + 1`).bind(ip, kind, bucket).run();
        const row = await db.prepare(`SELECT hits FROM kb_rate WHERE ip = ? AND kind = ? AND bucket = ?`).bind(ip, kind, bucket).first();
        if (Math.random() < 0.05) await db.prepare(`DELETE FROM kb_rate WHERE bucket < ?`).bind(bucket - 1).run();
        return !!(row && row.hits > limit);
    } catch (e) {
        console.error('kb rate counter failed', e);
        return false;
    }
}

// Common gate for every Knowledge Base API call. Returns { reader } or { response }.
export async function kbGate(request, env, { write = false } = {}) {
    const state = await getSiteState(env.DB);
    if (state.locked) return { response: json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423) };
    await ensureKbTables(env.TRAINING_DB);
    if (write && !sameOrigin(request)) return { response: json({ success: false, error: 'Requests must come from the LSH Training Portal.' }, 403) };
    const reader = await kbReader(request, env);
    if (!reader) return { response: json({ success: false, error: 'Enter the team access code to open the Knowledge Base.', code: 'KB_LOCKED' }, 401) };
    return { reader };
}

export const nowIso = () => new Date().toISOString();

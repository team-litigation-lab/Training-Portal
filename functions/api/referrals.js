import { json, requireSession, getSiteState } from '../_utils.js';

// "Got a referral?" on the portal home page: someone refers a person to LSH
// with that person's contact details and CV. Tables are created on first use.
//   POST   multipart/form-data → save a referral (public: no sign-in on the portal).
//          Guarded like the simulators: site Lock, same-origin only, and a per-IP
//          limit (REFERRAL_RATE_LIMIT per hour, default 5). CV: PDF, DOC or DOCX, up to 10 MB.
//   GET    admins: every referral (no file data).
//   GET    ?cv=<id> admins: download that referral's CV.
//   PATCH  { id, status, note } admins: update the status or the admin note.
//   DELETE ?id=<id> admins: delete the referral and its CV.
// The CV is stored in D1 in 1 MB parts (referral_files), since the portal has no
// file storage bucket and a D1 value is capped at 2 MB.

const MAX_FILE = 10 * 1024 * 1024;
const PART = 1000000;
const STATUSES = ['New', 'Contacted', 'Interviewing', 'Hired', 'Not a fit'];
const TYPES = {
    pdf: { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },                  // %PDF
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 0x03, 0x04] }, // zip
    doc: { mime: 'application/msword', magic: [0xd0, 0xcf, 0x11, 0xe0] }                // OLE
};

async function ensureTables(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS referrals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        location TEXT,
        role TEXT,
        linkedin TEXT,
        note TEXT,
        referrer_name TEXT NOT NULL,
        referrer_contact TEXT,
        file_name TEXT,
        file_type TEXT,
        file_size INTEGER,
        status TEXT NOT NULL DEFAULT 'New',
        admin_note TEXT,
        updated_at TEXT,
        updated_by TEXT
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS referral_files (
        referral_id INTEGER NOT NULL,
        part INTEGER NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (referral_id, part)
    )`).run();
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

async function guardPublic(request, env) {
    const state = await getSiteState(env.DB);
    if (state.locked) return json({ success: false, error: 'The portal is locked by an administrator. Try again later.', code: 'SITE_LOCKED' }, 423);
    const origin = request.headers.get('Origin');
    let originHost = null;
    try { originHost = origin ? new URL(origin).host : null; } catch (e) { originHost = null; }
    if (originHost !== new URL(request.url).host) return json({ success: false, error: 'Referrals can only be sent from the LSH Training Portal.' }, 403);

    const limit = Math.max(1, Number(env.REFERRAL_RATE_LIMIT) || 5);
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    const bucket = Math.floor(Date.now() / 3600000);
    const db = env.TRAINING_DB;
    await db.prepare(`CREATE TABLE IF NOT EXISTS referral_rate (ip TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip, bucket))`).run();
    await db.prepare(`INSERT INTO referral_rate (ip, bucket, hits) VALUES (?, ?, 1) ON CONFLICT(ip, bucket) DO UPDATE SET hits = hits + 1`).bind(ip, bucket).run();
    const row = await db.prepare(`SELECT hits FROM referral_rate WHERE ip = ? AND bucket = ?`).bind(ip, bucket).first();
    if (Math.random() < 0.05) await db.prepare(`DELETE FROM referral_rate WHERE bucket < ?`).bind(bucket - 1).run();
    if (row && row.hits > limit) return json({ success: false, error: 'Too many referrals from this connection. Please try again in an hour.' }, 429);
    return null;
}

export async function onRequestPost({ request, env }) {
    try {
        const blocked = await guardPublic(request, env);
        if (blocked) return blocked;
        let form;
        try { form = await request.formData(); } catch (e) { return json({ success: false, error: 'Invalid form.' }, 400); }
        if (clean(form.get('website'), 200)) return json({ success: true }); // honeypot: bots fill the hidden field

        const r = {
            name: clean(form.get('name'), 120),
            email: clean(form.get('email'), 160).toLowerCase(),
            phone: clean(form.get('phone'), 40),
            location: clean(form.get('location'), 120),
            role: clean(form.get('role'), 120),
            linkedin: clean(form.get('linkedin'), 300),
            note: clean(form.get('note'), 1500),
            referrer_name: clean(form.get('referrer_name'), 120),
            referrer_contact: clean(form.get('referrer_contact'), 160)
        };
        if (r.name.length < 2) return json({ success: false, error: "Enter the person's full name." }, 400);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return json({ success: false, error: "Enter the person's email address." }, 400);
        if (r.phone.replace(/\D/g, '').length < 7) return json({ success: false, error: "Enter the person's phone number." }, 400);
        if (r.referrer_name.length < 2) return json({ success: false, error: 'Enter your name.' }, 400);
        if (r.linkedin && !/^https?:\/\//i.test(r.linkedin)) r.linkedin = 'https://' + r.linkedin;
        if (form.get('consent') !== 'yes') return json({ success: false, error: 'Please confirm the person agreed to share their details and CV.' }, 400);

        const file = form.get('cv');
        if (!file || typeof file === 'string' || !file.size) return json({ success: false, error: 'Attach their CV (PDF, DOC or DOCX).' }, 400);
        if (file.size > MAX_FILE) return json({ success: false, error: 'The CV is over 10 MB. Please attach a smaller file.' }, 400);
        const ext = String(file.name || '').toLowerCase().split('.').pop();
        const type = TYPES[ext];
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!type || !type.magic.every((b, i) => bytes[i] === b)) return json({ success: false, error: 'The CV must be a PDF, DOC or DOCX file.' }, 400);
        const fileName = clean(file.name, 150).replace(/[\\/"]/g, '_') || `cv.${ext}`;

        const db = env.TRAINING_DB;
        await ensureTables(db);
        const now = new Date().toISOString();
        const ins = await db.prepare(`INSERT INTO referrals (created_at, name, email, phone, location, role, linkedin, note, referrer_name, referrer_contact, file_name, file_type, file_size, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New')`)
            .bind(now, r.name, r.email, r.phone, r.location, r.role, r.linkedin, r.note, r.referrer_name, r.referrer_contact, fileName, type.mime, bytes.length).run();
        const id = ins.meta && ins.meta.last_row_id;
        try {
            const parts = [];
            for (let off = 0, p = 0; off < bytes.length; off += PART, p++) {
                parts.push(db.prepare(`INSERT INTO referral_files (referral_id, part, data) VALUES (?, ?, ?)`).bind(id, p, bytes.slice(off, off + PART)));
            }
            await db.batch(parts);
        } catch (e) {
            await db.prepare(`DELETE FROM referral_files WHERE referral_id = ?`).bind(id).run();
            await db.prepare(`DELETE FROM referrals WHERE id = ?`).bind(id).run();
            throw e;
        }
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: 'Something went wrong saving the referral. Please try again.' }, 500);
    }
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const db = env.TRAINING_DB;
    try {
        await ensureTables(db);
        const cv = Number(new URL(request.url).searchParams.get('cv'));
        if (cv) {
            const ref = await db.prepare(`SELECT file_name, file_type FROM referrals WHERE id = ?`).bind(cv).first();
            if (!ref) return json({ success: false, error: 'Not found.' }, 404);
            const { results } = await db.prepare(`SELECT data FROM referral_files WHERE referral_id = ? ORDER BY part`).bind(cv).all();
            const chunks = (results || []).map(x => new Uint8Array(x.data));
            const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
            let off = 0; chunks.forEach(c => { out.set(c, off); off += c.length; });
            return new Response(out, { headers: {
                'Content-Type': ref.file_type || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${String(ref.file_name || 'cv').replace(/[^\w.\- ]/g, '_')}"`,
                'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
            } });
        }
        const { results } = await db.prepare(`SELECT id, created_at, name, email, phone, location, role, linkedin, note, referrer_name, referrer_contact, file_name, file_size, status, admin_note, updated_at, updated_by
            FROM referrals ORDER BY id DESC LIMIT 1000`).all();
        return json({ success: true, statuses: STATUSES, referrals: results || [] });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPatch({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const id = Number(body.id);
    if (!id) return json({ success: false, error: 'id is required.' }, 400);
    const status = body.status == null ? null : String(body.status);
    if (status != null && !STATUSES.includes(status)) return json({ success: false, error: 'Unknown status.' }, 400);
    const note = body.note == null ? null : clean(body.note, 2000);
    try {
        await ensureTables(env.TRAINING_DB);
        await env.TRAINING_DB.prepare(`UPDATE referrals SET status = COALESCE(?, status), admin_note = COALESCE(?, admin_note), updated_at = ?, updated_by = ? WHERE id = ?`)
            .bind(status, note, new Date().toISOString(), auth.session.fullName || auth.session.username, id).run();
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestDelete({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!id) return json({ success: false, error: 'id is required.' }, 400);
    try {
        await ensureTables(env.TRAINING_DB);
        await env.TRAINING_DB.batch([
            env.TRAINING_DB.prepare(`DELETE FROM referral_files WHERE referral_id = ?`).bind(id),
            env.TRAINING_DB.prepare(`DELETE FROM referrals WHERE id = ?`).bind(id)
        ]);
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

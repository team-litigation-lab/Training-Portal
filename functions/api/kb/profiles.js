import { json } from '../../_utils.js';
import { kbGate, KB_CATEGORIES, clean, oneLine, overLimit, nowIso } from '../../_kb.js';

// Contributor profiles in the Knowledge Base (/kb.html).
// A profile belongs to a person_key (their name and batch, or "admin|<username>").
// VAs sign in with only the team code and a name, so a VA's profile changes wait
// for an admin (as posts do); the approved version stays visible until then.
// An admin's changes, to their own profile or anyone's, apply straight away.
//   GET              → approved, visible profiles; my own (with any pending change)
//   GET ?queue=1     → (admin) profile changes waiting for review
//   POST { action:'save', key?, title, team, years, expertise, skills, bio, linkedin, photo }
//                      key only for admins editing someone else's profile
//   POST { action:'review', key, decision:'approve'|'reject', note }   admin
//   POST { action:'hide' | 'unhide', key }                              admin
const noStore = { 'Cache-Control': 'no-store' };
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function readProfile(body) {
    const expertise = (Array.isArray(body.expertise) ? body.expertise : []).filter(c => KB_CATEGORIES.includes(c)).slice(0, 8);
    const skills = (Array.isArray(body.skills) ? body.skills : String(body.skills || '').split(','))
        .map(t => oneLine(t, 40)).filter(Boolean).slice(0, 12);
    const years = body.years === '' || body.years == null ? null : Math.max(0, Math.min(50, Math.round(Number(body.years)) || 0));
    let linkedin = oneLine(body.linkedin, 200);
    if (linkedin && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(linkedin)) return { error: 'The LinkedIn link should start with https://www.linkedin.com/' };
    const photo = body.photo ? String(body.photo) : '';
    if (photo && (!PHOTO.test(photo) || photo.length > 150000)) return { error: 'That photo couldn’t be used. Try a smaller JPG or PNG.' };
    const bio = clean(body.bio, 800);
    return { profile: { title: oneLine(body.title, 80), team: oneLine(body.team, 80), years, expertise, skills: [...new Set(skills)], bio, linkedin, photo } };
}

const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
function shape(r, withPending) {
    const out = { key: r.person_key, name: r.name, batch: r.batch || '', profile: parse(r.profile), hidden: !!r.hidden, updatedAt: r.updated_at };
    if (withPending) Object.assign(out, { pending: parse(r.pending), pendingAt: r.pending_at, reviewNote: r.review_note || '' });
    return out;
}

export async function onRequestGet({ request, env }) {
    const gate = await kbGate(request, env); if (gate.response) return gate.response;
    const { reader } = gate, db = env.TRAINING_DB;
    try {
        if (new URL(request.url).searchParams.get('queue')) {
            if (!reader.admin) return json({ success: false, error: 'Admin sign-in required.' }, 403);
            const { results } = await db.prepare(`SELECT * FROM kb_profiles WHERE pending IS NOT NULL OR hidden = 1 ORDER BY pending_at DESC`).all();
            return json({ success: true, profiles: (results || []).map(r => shape(r, true)) }, 200, noStore);
        }
        const { results } = await db.prepare(`SELECT * FROM kb_profiles WHERE profile IS NOT NULL AND hidden = 0 ORDER BY name`).all();
        const mine = await db.prepare(`SELECT * FROM kb_profiles WHERE person_key = ?`).bind(reader.who.key).first();
        return json({ success: true, profiles: (results || []).map(r => shape(r, false)), me: { key: reader.who.key, name: reader.who.name, batch: reader.who.batch, ...(mine ? shape(mine, true) : {}) } }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const gate = await kbGate(request, env, { write: true }); if (gate.response) return gate.response;
    const { reader } = gate, db = env.TRAINING_DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const now = nowIso();
    try {
        if (body.action === 'save') {
            if (!reader.admin && await overLimit(request, db, 'profile', 10)) return json({ success: false, error: 'Too many changes in a short time. Wait a few minutes and try again.' }, 429);
            const key = reader.admin && body.key ? oneLine(body.key, 140) : reader.who.key;
            const existing = await db.prepare(`SELECT * FROM kb_profiles WHERE person_key = ?`).bind(key).first();
            if (key !== reader.who.key && !existing) return json({ success: false, error: 'That profile no longer exists.' }, 404);
            const r = readProfile(body); if (r.error) return json({ success: false, error: r.error }, 400);
            const name = existing ? existing.name : reader.who.name, batch = existing ? existing.batch : reader.who.batch;
            const data = JSON.stringify(r.profile);
            if (reader.admin) {
                await db.prepare(`INSERT INTO kb_profiles (person_key, name, batch, profile, pending, pending_at, review_note, updated_at, reviewed_by, reviewed_at)
                    VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)
                    ON CONFLICT(person_key) DO UPDATE SET profile = excluded.profile, pending = NULL, pending_at = NULL, review_note = NULL,
                    updated_at = excluded.updated_at, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at`)
                    .bind(key, name, batch, data, now, reader.adminUser, now).run();
                return json({ success: true, status: 'published' });
            }
            await db.prepare(`INSERT INTO kb_profiles (person_key, name, batch, pending, pending_at, review_note)
                VALUES (?, ?, ?, ?, ?, NULL)
                ON CONFLICT(person_key) DO UPDATE SET pending = excluded.pending, pending_at = excluded.pending_at, review_note = NULL`)
                .bind(key, name, batch, data, now).run();
            return json({ success: true, status: 'pending' });
        }

        if (!reader.admin) return json({ success: false, error: 'Admin sign-in required.' }, 403);
        const key = oneLine(body.key, 140);
        const row = await db.prepare(`SELECT * FROM kb_profiles WHERE person_key = ?`).bind(key).first();
        if (!row) return json({ success: false, error: 'That profile no longer exists.' }, 404);

        if (body.action === 'review') {
            if (body.decision === 'approve') {
                if (!row.pending) return json({ success: true });
                await db.prepare(`UPDATE kb_profiles SET profile = pending, pending = NULL, pending_at = NULL, review_note = NULL, updated_at = ?, reviewed_by = ?, reviewed_at = ? WHERE person_key = ?`)
                    .bind(now, reader.adminUser, now, key).run();
                return json({ success: true, status: 'published' });
            }
            if (body.decision === 'reject') {
                const note = oneLine(body.note, 600);
                if (!note) return json({ success: false, error: 'Tell them what to change (they’ll see this note).' }, 400);
                await db.prepare(`UPDATE kb_profiles SET pending = NULL, pending_at = NULL, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE person_key = ?`)
                    .bind(note, reader.adminUser, now, key).run();
                return json({ success: true, status: 'rejected' });
            }
            return json({ success: false, error: 'Unknown decision.' }, 400);
        }
        if (body.action === 'hide' || body.action === 'unhide') {
            await db.prepare(`UPDATE kb_profiles SET hidden = ?, reviewed_by = ?, reviewed_at = ? WHERE person_key = ?`).bind(body.action === 'hide' ? 1 : 0, reader.adminUser, now, key).run();
            return json({ success: true });
        }
        return json({ success: false, error: 'Unknown action.' }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

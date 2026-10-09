import { json, requireSession, getSiteState } from '../_utils.js';

// "Rate your training" on the landing page: a trainee scores their training out
// of five and says why, an admin approves it, and only then does it show
// publicly. The table is created on first use, like referrals.
//   GET                      anyone: the APPROVED ratings only, plus the average. No sign-in:
//                            this is what the landing page shows to a visitor.
//   GET ?mine=1              signed in: that person's own rating, whatever its status, so the
//                            form can open filled in and say where it stands.
//   GET ?all=1               admins: every rating, with counts per status.
//   POST { rating, comment, program, showName }
//                            signed in: save that person's rating. One per person — sending
//                            again replaces it and puts it back in the queue, since the text
//                            an admin approved is not the text that would then be showing.
//   PATCH { id, status, note }  admins: approve, reject or re-queue a rating, and keep a note.
//   DELETE ?id=<id>          admins: delete a rating.
//
// Approval is the whole point of the feature, so "Pending" is the only status a
// POST can set and the public GET filters on status alone — there is no path
// that puts un-approved words on the landing page.

const STATUSES = ['Pending', 'Approved', 'Rejected'];
const MAX_COMMENT = 1200;

async function ensureTable(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        full_name TEXT,
        batch_id TEXT,
        user_type TEXT,
        program TEXT,
        rating INTEGER NOT NULL,
        comment TEXT,
        show_name INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'Pending',
        admin_note TEXT,
        decided_at TEXT,
        decided_by TEXT
    )`).run();
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
// What a visitor is allowed to see: the score, the words, and a name only if the
// person who wrote it asked for their name to be shown.
const publicRow = r => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment || '',
    program: r.program || '',
    name: r.show_name ? (r.full_name || '') : '',
    created_at: r.created_at
});

export async function onRequestGet({ request, env }) {
    const db = env.TRAINING_DB;
    const url = new URL(request.url);
    try {
        if (url.searchParams.get('all')) {
            const auth = await requireSession(request, env, { adminOnly: true });
            if (!auth.ok) return auth.response;
            await ensureTable(db);
            const { results } = await db.prepare(`SELECT * FROM feedback ORDER BY
                CASE status WHEN 'Pending' THEN 0 WHEN 'Approved' THEN 1 ELSE 2 END, id DESC LIMIT 2000`).all();
            return json({ success: true, statuses: STATUSES, feedback: results || [] }, 200, { 'Cache-Control': 'no-store' });
        }
        if (url.searchParams.get('mine')) {
            const auth = await requireSession(request, env);
            if (!auth.ok) return auth.response;
            await ensureTable(db);
            const row = await db.prepare(`SELECT id, rating, comment, program, show_name, status, created_at FROM feedback WHERE username = ?`)
                .bind(auth.session.username).first();
            return json({ success: true, mine: row || null }, 200, { 'Cache-Control': 'no-store' });
        }
        // The public list. No sign-in, so a locked site gets nothing rather than
        // an error the landing page would have to explain to a visitor.
        if ((await getSiteState(env.DB)).locked) return json({ success: true, count: 0, average: 0, feedback: [] });
        await ensureTable(db);
        const { results } = await db.prepare(`SELECT id, created_at, full_name, program, rating, comment, show_name
            FROM feedback WHERE status = 'Approved' ORDER BY id DESC LIMIT 60`).all();
        const rows = results || [];
        const average = rows.length ? Math.round((rows.reduce((n, r) => n + r.rating, 0) / rows.length) * 10) / 10 : 0;
        return json({ success: true, count: rows.length, average, feedback: rows.map(publicRow) });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const db = env.TRAINING_DB;
    try {
        let body;
        try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request.' }, 400); }
        const rating = Math.round(Number(body.rating));
        if (!(rating >= 1 && rating <= 5)) return json({ success: false, error: 'Choose a rating from 1 to 5 stars.' }, 400);
        const comment = clean(body.comment, MAX_COMMENT);
        if (!comment) return json({ success: false, error: 'Please say a little about your training.' }, 400);
        await ensureTable(db);
        const s = auth.session;
        const now = new Date().toISOString();
        // Sending again replaces the row and clears the decision: an admin
        // approved particular words, and these are different words.
        await db.prepare(`INSERT INTO feedback (created_at, username, full_name, batch_id, user_type, program, rating, comment, show_name, status, decided_at, decided_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NULL, NULL)
            ON CONFLICT(username) DO UPDATE SET
                created_at = excluded.created_at, full_name = excluded.full_name, batch_id = excluded.batch_id,
                program = excluded.program, rating = excluded.rating, comment = excluded.comment,
                show_name = excluded.show_name, status = 'Pending', decided_at = NULL, decided_by = NULL`)
            .bind(now, s.username, s.fullName || s.username, s.batchId || null, s.userType || null,
                clean(body.program, 80), rating, comment, body.showName === false ? 0 : 1).run();
        return json({ success: true, status: 'Pending' });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPatch({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const db = env.TRAINING_DB;
    try {
        let body;
        try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request.' }, 400); }
        const id = Number(body.id);
        if (!id) return json({ success: false, error: 'Which rating?' }, 400);
        await ensureTable(db);
        if (body.status != null) {
            if (!STATUSES.includes(body.status)) return json({ success: false, error: 'Unknown status.' }, 400);
            await db.prepare(`UPDATE feedback SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`)
                .bind(body.status, new Date().toISOString(), auth.session.username, id).run();
        }
        if (body.note != null) {
            await db.prepare(`UPDATE feedback SET admin_note = ? WHERE id = ?`).bind(clean(body.note, 600), id).run();
        }
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestDelete({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const db = env.TRAINING_DB;
    try {
        const id = Number(new URL(request.url).searchParams.get('id'));
        if (!id) return json({ success: false, error: 'Which rating?' }, 400);
        await ensureTable(db);
        await db.prepare(`DELETE FROM feedback WHERE id = ?`).bind(id).run();
        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

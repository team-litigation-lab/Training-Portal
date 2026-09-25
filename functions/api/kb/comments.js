import { json } from '../../_utils.js';
import { kbGate, clean, overLimit, nowIso, oneLine } from '../../_kb.js';

// "Add your experience" replies under a Knowledge Base post or SOP (/kb.html).
// VAs' replies wait for an admin, like posts; an admin's reply is published straight away.
//   POST { action:'submit', ref, body }
//   POST { action:'review', id, decision:'approve'|'reject'|'delete', note }   admin
const REF = /^(a:\d{1,9}|s:[a-z0-9][a-z0-9-]{0,79})$/;

export async function onRequestPost({ request, env }) {
    const gate = await kbGate(request, env, { write: true }); if (gate.response) return gate.response;
    const { reader } = gate, db = env.TRAINING_DB;
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    try {
        if (body.action === 'submit') {
            const ref = String(body.ref || '');
            if (!REF.test(ref)) return json({ success: false, error: 'Unknown article.' }, 400);
            if (ref.startsWith('a:')) {
                const a = await db.prepare(`SELECT status FROM kb_articles WHERE id = ?`).bind(Number(ref.slice(2))).first();
                if (!a || a.status !== 'published') return json({ success: false, error: 'You can reply once the post is published.' }, 409);
            }
            if (!reader.admin && await overLimit(request, db, 'comment', 20)) return json({ success: false, error: 'You’ve replied a lot in a short time. Wait a few minutes and try again.' }, 429);
            const text = clean(body.body, 5000);
            if (text.length < 5) return json({ success: false, error: 'Write a little more.' }, 400);
            const status = reader.admin ? 'approved' : 'pending';
            await db.prepare(`INSERT INTO kb_comments (article_ref, body, author_name, author_batch, author_key, by_admin, status, created_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(ref, text, reader.who.name, reader.who.batch, reader.who.key, reader.admin ? 1 : 0, status, nowIso(), request.headers.get('CF-Connecting-IP') || null).run();
            return json({ success: true, status });
        }
        if (body.action === 'review') {
            if (!reader.admin) return json({ success: false, error: 'Admin sign-in required.' }, 403);
            const status = { approve: 'approved', reject: 'rejected', delete: 'deleted' }[body.decision];
            if (!status) return json({ success: false, error: 'Unknown decision.' }, 400);
            await db.prepare(`UPDATE kb_comments SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
                .bind(status, oneLine(body.note, 600) || null, reader.adminUser, nowIso(), Number(body.id)).run();
            return json({ success: true, status });
        }
        return json({ success: false, error: 'Unknown action.' }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

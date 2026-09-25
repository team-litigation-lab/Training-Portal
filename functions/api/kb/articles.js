import { json } from '../../_utils.js';
import { kbGate, KB_CATEGORIES, KB_TYPES, clean, oneLine, overLimit, nowIso } from '../../_kb.js';

// Knowledge Base posts (/kb.html). Every call needs Knowledge Base access (team code or admin).
//   GET                 → published posts, stats, my votes, my own posts (any status)
//   GET ?ref=a:12|s:slug → one post (or an SOP's comments/stats) + comments; counts a view
//   GET ?queue=1  (admin) → posts and comments waiting for review, plus every post
//   POST { action:'submit', type, category, title, summary, body, tags, linkUrl }
//        VAs' posts wait for an admin; an admin's post is published straight away.
//   POST { action:'edit', id, …same fields }   admin: any post; VA: their own while pending or rejected
//   POST { action:'review', id, decision:'approve'|'reject'|'hide'|'feature'|'unfeature', note }  admin
//   POST { action:'delete', id }               admin: any post; VA: their own while pending
//   POST { action:'helpful', ref }             toggles the reader's "helpful" vote
const noStore = { 'Cache-Control': 'no-store' };
const REF = /^(a:\d{1,9}|s:[a-z0-9][a-z0-9-]{0,79})$/;

function fields(body) {
    const type = KB_TYPES.includes(body.type) ? body.type : null;
    const category = KB_CATEGORIES.includes(body.category) ? body.category : null;
    const title = oneLine(body.title, 160);
    const summary = oneLine(body.summary, 400);
    const text = clean(body.body, 30000);
    const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(','))
        .map(t => oneLine(t, 30).toLowerCase()).filter(Boolean).slice(0, 8);
    let linkUrl = oneLine(body.linkUrl, 500);
    if (linkUrl && !/^https:\/\//i.test(linkUrl)) return { error: 'Links must start with https://' };
    if (!type) return { error: 'Choose what kind of post this is.' };
    if (!category) return { error: 'Choose a category.' };
    if (title.length < 5) return { error: 'Give it a title (at least 5 characters).' };
    if (text.length < 20) return { error: 'Write a bit more: at least a couple of sentences.' };
    return { type, category, title, summary, body: text, tags: [...new Set(tags)].join(','), linkUrl };
}

function shape(r, withBody = true) {
    return {
        id: r.id, ref: 'a:' + r.id, type: r.type, category: r.category, title: r.title, summary: r.summary || '',
        ...(withBody ? { body: r.body } : {}), tags: r.tags ? r.tags.split(',') : [], linkUrl: r.link_url || '',
        author: r.author_name, batch: r.author_batch || '', byAdmin: !!r.by_admin, status: r.status, featured: !!r.featured,
        reviewNote: r.review_note || '', reviewedAt: r.reviewed_at || null, createdAt: r.created_at, updatedAt: r.updated_at
    };
}
const shapeComment = (c) => ({ id: c.id, ref: c.article_ref, body: c.body, author: c.author_name, batch: c.author_batch || '',
    byAdmin: !!c.by_admin, status: c.status, reviewNote: c.review_note || '', createdAt: c.created_at });

async function statsMap(db) {
    const { results } = await db.prepare(`SELECT article_ref, views, helpful FROM kb_stats`).all();
    const { results: cc } = await db.prepare(`SELECT article_ref, COUNT(*) AS n FROM kb_comments WHERE status = 'approved' GROUP BY article_ref`).all();
    const map = {};
    (results || []).forEach(r => { map[r.article_ref] = { views: r.views, helpful: r.helpful, comments: 0 }; });
    (cc || []).forEach(r => { (map[r.article_ref] = map[r.article_ref] || { views: 0, helpful: 0, comments: 0 }).comments = r.n; });
    return map;
}

export async function onRequestGet({ request, env }) {
    const gate = await kbGate(request, env); if (gate.response) return gate.response;
    const { reader } = gate, db = env.TRAINING_DB, url = new URL(request.url);
    try {
        const ref = url.searchParams.get('ref');
        if (ref) {
            if (!REF.test(ref)) return json({ success: false, error: 'Unknown article.' }, 404);
            let article = null;
            if (ref.startsWith('a:')) {
                const r = await db.prepare(`SELECT * FROM kb_articles WHERE id = ?`).bind(Number(ref.slice(2))).first();
                if (!r || (r.status !== 'published' && !reader.admin && r.author_key !== reader.who.key)) return json({ success: false, error: 'That post isn’t available.' }, 404);
                article = shape(r);
            }
            if (!article || article.status === 'published') {
                await db.prepare(`INSERT INTO kb_stats (article_ref, views) VALUES (?, 1) ON CONFLICT(article_ref) DO UPDATE SET views = views + 1`).bind(ref).run();
            }
            const { results } = await db.prepare(
                reader.admin ? `SELECT * FROM kb_comments WHERE article_ref = ? AND status != 'deleted' ORDER BY id`
                    : `SELECT * FROM kb_comments WHERE article_ref = ? AND (status = 'approved' OR (author_key = ? AND status != 'deleted')) ORDER BY id`
            ).bind(...(reader.admin ? [ref] : [ref, reader.who.key])).all();
            const st = await db.prepare(`SELECT views, helpful FROM kb_stats WHERE article_ref = ?`).bind(ref).first();
            const voted = !!(await db.prepare(`SELECT 1 AS v FROM kb_votes WHERE article_ref = ? AND voter = ?`).bind(ref, reader.who.key).first());
            return json({ success: true, article, comments: (results || []).map(shapeComment), stats: { views: st ? st.views : 0, helpful: st ? st.helpful : 0 }, voted }, 200, noStore);
        }

        if (url.searchParams.get('queue')) {
            if (!reader.admin) return json({ success: false, error: 'Admin sign-in required.' }, 403);
            const { results: posts } = await db.prepare(`SELECT * FROM kb_articles ORDER BY (status = 'pending') DESC, updated_at DESC LIMIT 1000`).all();
            const { results: comments } = await db.prepare(`SELECT * FROM kb_comments WHERE status = 'pending' ORDER BY id`).all();
            return json({ success: true, posts: (posts || []).map(r => shape(r)), comments: (comments || []).map(shapeComment) }, 200, noStore);
        }

        const { results } = await db.prepare(`SELECT * FROM kb_articles WHERE status = 'published' ORDER BY featured DESC, updated_at DESC LIMIT 2000`).all();
        const { results: mine } = await db.prepare(`SELECT * FROM kb_articles WHERE author_key = ? ORDER BY updated_at DESC LIMIT 200`).bind(reader.who.key).all();
        const { results: votes } = await db.prepare(`SELECT article_ref FROM kb_votes WHERE voter = ?`).bind(reader.who.key).all();
        let pending = undefined;
        if (reader.admin) {
            const a = await db.prepare(`SELECT COUNT(*) AS n FROM kb_articles WHERE status = 'pending'`).first();
            const c = await db.prepare(`SELECT COUNT(*) AS n FROM kb_comments WHERE status = 'pending'`).first();
            pending = { posts: a ? a.n : 0, comments: c ? c.n : 0 };
        }
        return json({ success: true, articles: (results || []).map(r => shape(r)), stats: await statsMap(db),
            myVotes: (votes || []).map(v => v.article_ref), mine: (mine || []).map(r => shape(r, false)), pending,
            categories: KB_CATEGORIES, types: KB_TYPES }, 200, noStore);
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
        if (body.action === 'submit') {
            if (!reader.admin && await overLimit(request, db, 'post', 10)) return json({ success: false, error: 'You’ve posted a lot in a short time. Wait a few minutes and try again.' }, 429);
            const f = fields(body); if (f.error) return json({ success: false, error: f.error }, 400);
            const status = reader.admin ? 'published' : 'pending';
            const r = await db.prepare(`INSERT INTO kb_articles (type, category, title, summary, body, tags, link_url, author_name, author_batch, author_key, by_admin, status, reviewed_by, reviewed_at, created_at, updated_at, ip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(f.type, f.category, f.title, f.summary, f.body, f.tags, f.linkUrl, reader.who.name, reader.who.batch, reader.who.key, reader.admin ? 1 : 0,
                      status, reader.admin ? reader.adminUser : null, reader.admin ? now : null, now, now, request.headers.get('CF-Connecting-IP') || null).run();
            return json({ success: true, id: r.meta && r.meta.last_row_id, status });
        }

        const id = Number(body.id);
        const row = id ? await db.prepare(`SELECT * FROM kb_articles WHERE id = ?`).bind(id).first() : null;

        if (body.action === 'edit') {
            if (!row) return json({ success: false, error: 'That post no longer exists.' }, 404);
            const own = row.author_key === reader.who.key && (row.status === 'pending' || row.status === 'rejected');
            if (!reader.admin && !own) return json({ success: false, error: 'You can only edit your own posts while they’re waiting for review or were sent back.' }, 403);
            const f = fields(body); if (f.error) return json({ success: false, error: f.error }, 400);
            const status = reader.admin ? row.status : 'pending';   // a VA's fixed post goes back into the queue
            await db.prepare(`UPDATE kb_articles SET type = ?, category = ?, title = ?, summary = ?, body = ?, tags = ?, link_url = ?, status = ?, updated_at = ? WHERE id = ?`)
                .bind(f.type, f.category, f.title, f.summary, f.body, f.tags, f.linkUrl, status, now, id).run();
            return json({ success: true, status });
        }

        if (body.action === 'review') {
            if (!reader.admin) return json({ success: false, error: 'Admin sign-in required.' }, 403);
            if (!row) return json({ success: false, error: 'That post no longer exists.' }, 404);
            const note = oneLine(body.note, 600);
            const set = { approve: ['published', row.featured], reject: ['rejected', 0], hide: ['hidden', 0], feature: ['published', 1], unfeature: [row.status, 0] }[body.decision];
            if (!set) return json({ success: false, error: 'Unknown decision.' }, 400);
            if (body.decision === 'reject' && !note) return json({ success: false, error: 'Tell the author what to change (they’ll see this note).' }, 400);
            await db.prepare(`UPDATE kb_articles SET status = ?, featured = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
                .bind(set[0], set[1] ? 1 : 0, note || row.review_note || null, reader.adminUser, now, id).run();
            return json({ success: true, status: set[0] });
        }

        if (body.action === 'delete') {
            if (!row) return json({ success: true });
            if (!reader.admin && !(row.author_key === reader.who.key && row.status === 'pending')) return json({ success: false, error: 'You can only withdraw your own posts while they’re waiting for review.' }, 403);
            await db.prepare(`DELETE FROM kb_articles WHERE id = ?`).bind(id).run();
            await db.prepare(`UPDATE kb_comments SET status = 'deleted' WHERE article_ref = ?`).bind('a:' + id).run();
            return json({ success: true });
        }

        if (body.action === 'helpful') {
            const ref = String(body.ref || '');
            if (!REF.test(ref)) return json({ success: false, error: 'Unknown article.' }, 400);
            const had = await db.prepare(`SELECT 1 AS v FROM kb_votes WHERE article_ref = ? AND voter = ?`).bind(ref, reader.who.key).first();
            if (had) {
                await db.prepare(`DELETE FROM kb_votes WHERE article_ref = ? AND voter = ?`).bind(ref, reader.who.key).run();
                await db.prepare(`UPDATE kb_stats SET helpful = MAX(0, helpful - 1) WHERE article_ref = ?`).bind(ref).run();
            } else {
                const r = await db.prepare(`INSERT OR IGNORE INTO kb_votes (article_ref, voter, created_at) VALUES (?, ?, ?)`).bind(ref, reader.who.key, now).run();
                if (r.meta && r.meta.changes) await db.prepare(`INSERT INTO kb_stats (article_ref, helpful) VALUES (?, 1) ON CONFLICT(article_ref) DO UPDATE SET helpful = helpful + 1`).bind(ref).run();
            }
            const st = await db.prepare(`SELECT helpful FROM kb_stats WHERE article_ref = ?`).bind(ref).first();
            return json({ success: true, voted: !had, helpful: st ? st.helpful : 0 });
        }

        return json({ success: false, error: 'Unknown action.' }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

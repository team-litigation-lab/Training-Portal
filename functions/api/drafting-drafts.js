import { json, requireSession } from '../_utils.js';

// ✍ Drafting (simulators/drafting.html): the letters a trainee is drafting, saved to their Portal account, so a letter
// follows them to another browser or computer (the page also keeps it in the browser, and opens the newer of the two).
// One row per person and letter in TRAINING_DB (made on first use):
//   drafting_drafts   username, letter, data, updated_at
//     letter  the letter's id on the page ('lor1p', 'lor3p', 'prov:<provider>:medlor' …), or '_state' for the page's own
//             choices (the case, the provider, the HIPAA's answers), or '<letter>:pdf' for the trainee's PDF of that letter,
//             edited in Nitro Pro and saved back to the platform ({ name, b64, at })
//     data    what the page sends, as it sends it: a letter is its word/document.xml, deflated and base64'd, with when the
//             trainee last changed it ({ z, at }); stored and handed back as text, never read here
//
//   GET  /api/drafting-drafts                    my saved letters: [{ letter, updatedAt }]
//   GET  /api/drafting-drafts?letter=<id>        one of mine: { data, updatedAt } (data null: nothing saved)
//   GET  /api/drafting-drafts?letter=<id>&user=<username>   (admins) a trainee's, for looking at their work
//   GET  /api/drafting-drafts?letter=<id>:pdf&raw=1 (&user=…)  a saved PDF itself (application/pdf), to open in the browser
//   GET  /api/drafting-drafts?pdfs=1             (admins) every trainee's saved PDF: [{ username, name, batch, letter, updatedAt }]
//   POST { action:'draft', letter, data, base }  save mine; `base` is the updatedAt this copy was made from: if a newer one is
//                                                saved (another tab or device) the answer is 409 DRAFT_NEWER and nothing changes
//   POST { action:'delete', letter }             Start over: my saved copy of that letter is gone
const MAX = 400000;                                  // a deflated letter is ~10 KB; the biggest template's XML is ~70 KB raw
// '<letter>:pdf' is the trainee's own PDF of it, edited in Nitro Pro and saved back (base64): up to ~1.4 MB of PDF, inside D1's 2 MB value.
const MAX_PDF = 1900000;
const maxOf = (letter) => /:pdf$/.test(letter) ? MAX_PDF : MAX;
const LETTER = /^[\w:.\-]{1,160}$/;
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const nowIso = () => new Date().toISOString();
const changed = (r) => { const n = r && r.meta && r.meta.changes != null ? r.meta.changes : r && r.changes; return n == null || n > 0; };

async function ensure(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS drafting_drafts (username TEXT NOT NULL, letter TEXT NOT NULL, data TEXT NOT NULL,
        updated_at TEXT NOT NULL, PRIMARY KEY (username, letter))`).run();
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const s = auth.session, db = env.TRAINING_DB;
    await ensure(db);
    const q = new URL(request.url).searchParams;
    // (admins) every trainee's edited PDF (from Nitro Pro), newest first, for the trainer's list on the Drafting page
    if (q.get('pdfs') != null) {
        if (s.userType !== 'Admin') return json({ success: false, error: 'Admin access required.' }, 403);
        const { results } = await db.prepare(`SELECT username, letter, updated_at FROM drafting_drafts WHERE letter LIKE '%:pdf' ORDER BY updated_at DESC LIMIT 500`).all();
        // the trainee's name and batch, from the accounts (env.DB users); the username alone if they can't be read
        const who = {};
        const names = [...new Set((results || []).map(r => r.username))];
        try {
            for (let i = 0; i < names.length && env.DB; i += 90) {
                const part = names.slice(i, i + 90);
                const { results: us } = await env.DB.prepare(`SELECT username, first_name, last_name, batch_id FROM users WHERE username IN (${part.map(() => '?').join(', ')})`).bind(...part).all();
                (us || []).forEach(u => { who[u.username] = { name: [u.first_name, u.last_name].filter(Boolean).join(' '), batch: u.batch_id || '' }; });
            }
        } catch (e) { /* names are a convenience: the list still shows usernames */ }
        return json({ success: true, pdfs: (results || []).map(r => ({ username: r.username, name: (who[r.username] || {}).name || '', batch: (who[r.username] || {}).batch || '',
            letter: r.letter, updatedAt: r.updated_at })) });
    }
    if (q.get('letter') != null) {
        const letter = clean(q.get('letter'), 160);
        if (!LETTER.test(letter)) return json({ success: false, error: 'Unknown letter.' }, 400);
        const other = q.get('user') ? clean(q.get('user'), 80) : '';
        if (other && s.userType !== 'Admin') return json({ success: false, error: 'Admin access required.' }, 403);
        const r = await db.prepare(`SELECT data, updated_at FROM drafting_drafts WHERE username = ? AND letter = ?`).bind(other || s.username, letter).first();
        // &raw=1 on a '<letter>:pdf': the PDF itself, to open in the browser (a trainer reading a trainee's)
        if (q.get('raw') != null && /:pdf$/.test(letter)) {
            let p = null;
            try { p = r ? JSON.parse(r.data) : null; } catch (e) { /* not a saved PDF */ }
            if (!p || !p.b64) return json({ success: false, error: 'No saved PDF.' }, 404);
            const bin = atob(p.b64), out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            const name = String(p.name || 'edited.pdf').replace(/[^\w .()-]/g, '_');   // a header is plain ASCII
            return new Response(out, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'no-store' } });
        }
        return json({ success: true, letter, data: r ? r.data : null, updatedAt: r ? r.updated_at : null });
    }
    const { results } = await db.prepare(`SELECT letter, updated_at FROM drafting_drafts WHERE username = ? ORDER BY updated_at DESC LIMIT 300`).bind(s.username).all();
    return json({ success: true, letters: (results || []).map(r => ({ letter: r.letter, updatedAt: r.updated_at })) });
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;
    const s = auth.session, db = env.TRAINING_DB;
    await ensure(db);
    let b;
    try { b = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    const letter = clean(b && b.letter, 160);
    if (!LETTER.test(letter)) return json({ success: false, error: 'Unknown letter.' }, 400);
    if (b.action === 'delete') {
        await db.prepare(`DELETE FROM drafting_drafts WHERE username = ? AND letter = ?`).bind(s.username, letter).run();
        return json({ success: true });
    }
    if (b.action !== 'draft') return json({ success: false, error: 'Unknown action.' }, 400);
    const data = typeof b.data === 'string' ? b.data : '';
    if (!data || data.length > maxOf(letter)) return json({ success: false, error: data ? (/:pdf$/.test(letter) ? 'This PDF is too large to save (1.4 MB at most).' : 'This letter is too large to save.') : 'Nothing to save.' }, 400);
    const at = nowIso();
    // `base`: the copy this one was made from. A copy saved after it (another tab or device) is not overwritten by an older one.
    const t = typeof b.base === 'string' ? Date.parse(b.base) : NaN, base = Number.isFinite(t) ? new Date(t).toISOString() : null;
    const w = await db.prepare(`INSERT INTO drafting_drafts (username, letter, data, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(username, letter) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
        WHERE ? IS NULL OR drafting_drafts.updated_at <= ?`).bind(s.username, letter, data, at, base, base).run();
    if (!changed(w)) {
        const cur = await db.prepare(`SELECT updated_at FROM drafting_drafts WHERE username = ? AND letter = ?`).bind(s.username, letter).first();
        return json({ success: false, code: 'DRAFT_NEWER', error: 'A newer copy of this letter is saved to your account (from another tab or device).', updatedAt: cur ? cur.updated_at : null }, 409);
    }
    return json({ success: true, updatedAt: at });
}

import { json, requireSession } from '../_utils.js';

// 📊 The server request meter on the admin pages (request-budget.js, started from portal.js;
// README → Server request meter), admins only.
// Every LSH site shares one Cloudflare account and one monthly request allowance. The Request budget
// workflow in EA-PA-TRAINING (.github/scripts/request-budget.mjs) saves the billing month's numbers to
// the courses' KV namespace (COURSE_KV here) under "_request-usage"; this hands them to an Admin,
// without the workflow's own working data ("cache").
//   GET → { ok: true, usage: { at, month, total, limit, projected, paused, sites, days, ... } | null }
//         (null until the workflow has saved any, or without the COURSE_KV binding)
export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const noStore = { 'Cache-Control': 'no-store' };
    try {
        return json({ ok: true, usage: await readUsage(env.COURSE_KV) }, 200, noStore);
    } catch (err) {
        return json({ success: false, error: 'Couldn’t read the numbers: ' + err.message }, 500, noStore);
    }
}

async function readUsage(kv) {
    const raw = kv ? await kv.get('_request-usage') : null;
    if (!raw) return null;
    try {
        const u = JSON.parse(raw);
        if (!u || typeof u !== 'object') return null;
        delete u.cache;
        return u;
    } catch (e) { return null; }
}

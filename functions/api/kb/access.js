import { json, getSiteState, hashPassword, verifyPassword } from '../../_utils.js';
import { ensureKbTables, getSetting, setSetting, kbReader, adminSession, issueReaderCookie, clearReaderCookie, sameOrigin, overLimit, oneLine, nowIso } from '../../_kb.js';

// Knowledge Base access (/kb.html).
//   GET                                   → { configured, unlocked, admin, who }
//   POST { action:'unlock', code, name, batch }  → sets the reader cookie
//   POST { action:'signout' }                    → clears it
//   POST { action:'set-code', code }  (admin)    → sets or changes the team access code;
//                                                  everyone who used the old code is signed out
const noStore = { 'Cache-Control': 'no-store' };

export async function onRequestGet({ request, env }) {
    const state = await getSiteState(env.DB);
    if (state.locked) return json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423);
    await ensureKbTables(env.TRAINING_DB);
    const configured = !!(await getSetting(env.TRAINING_DB, 'code_hash'));
    const reader = await kbReader(request, env);
    return json({ success: true, configured, unlocked: !!reader, admin: !!(reader && reader.admin),
        who: reader ? { name: reader.who.name, batch: reader.who.batch } : null,
        codeChangedAt: reader && reader.admin ? await getSetting(env.TRAINING_DB, 'code_changed_at') : undefined }, 200, noStore);
}

export async function onRequestPost({ request, env }) {
    const state = await getSiteState(env.DB);
    if (state.locked) return json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423);
    if (!sameOrigin(request)) return json({ success: false, error: 'Requests must come from the LSH Training Portal.' }, 403);
    const db = env.TRAINING_DB;
    await ensureKbTables(db);
    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }

    if (body.action === 'signout') {
        return json({ success: true }, 200, { ...noStore, 'Set-Cookie': clearReaderCookie() });
    }

    if (body.action === 'unlock') {
        // The shared team access code is retired: the Knowledge Base opens only for people signed in on the LSH Training Portal.
        return json({ success: false, error: 'Sign in on the LSH Training Portal to open the Knowledge Base.', code: 'PORTAL_ONLY' }, 403);
    }

    if (body.action === 'set-code') {
        const admin = await adminSession(request, env);
        if (!admin) return json({ success: false, error: 'Admin sign-in required.' }, 403);
        const code = String(body.code || '').trim();
        if (code.length < 6 || code.length > 64) return json({ success: false, error: 'Use an access code of 6 to 64 characters.' }, 400);
        await setSetting(db, 'code_hash', await hashPassword(code));
        await setSetting(db, 'code_version', crypto.randomUUID());
        await setSetting(db, 'code_changed_at', nowIso());
        await setSetting(db, 'code_changed_by', String(admin.username));
        return json({ success: true }, 200, noStore);
    }

    return json({ success: false, error: 'Unknown action.' }, 400);
}

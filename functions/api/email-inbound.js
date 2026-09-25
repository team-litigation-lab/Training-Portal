import { json } from '../_utils.js';
import { ensureEmailTable } from '../_email.js';

// Postmark inbound webhook for Email Replies (/simulators/email-replies.html).
// Set the server's Inbound webhook URL to:
//   https://<portal address>/api/email-inbound?key=<EMAIL_INBOUND_SECRET>
// Practice emails go out with Reply-To <inbound>+<token>@inbound.postmarkapp.com,
// so Postmark hands us the token as MailboxHash. The Email Replies page polls
// /api/email-practice?token=… and scores the reply.
function sameSecret(a, b) {
    a = String(a || ''); b = String(b || '');
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export async function onRequestPost({ request, env }) {
    const key = new URL(request.url).searchParams.get('key');
    if (!env.EMAIL_INBOUND_SECRET || !sameSecret(key, env.EMAIL_INBOUND_SECRET)) {
        return json({ success: false, error: 'Forbidden.' }, 403);
    }
    let mail;
    try { mail = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid body.' }, 400); }

    const token = String(mail.MailboxHash || '').toLowerCase();
    // Always 200 for mail we can't match, so Postmark doesn't keep retrying it.
    if (!/^[a-f0-9]{32}$/.test(token)) return json({ success: true, ignored: 'no practice token' });

    const text = String(mail.StrippedTextReply || mail.TextBody || '').trim().slice(0, 20000);
    const from = String((mail.FromFull && mail.FromFull.Email) || mail.From || '').slice(0, 200);
    try {
        await ensureEmailTable(env.TRAINING_DB);
        // First reply counts; later replies to the same practice email are ignored.
        const r = await env.TRAINING_DB.prepare(
            `UPDATE email_practice SET reply_text = ?, reply_from = ?, replied_at = ? WHERE token = ? AND replied_at IS NULL`
        ).bind(text || '(empty reply)', from, new Date().toISOString(), token).run();
        return json({ success: true, stored: !!(r && r.meta && r.meta.changes) });
    } catch (err) {
        console.error('email-inbound failed', err);
        return json({ success: false, error: err.message }, 500);
    }
}

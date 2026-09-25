import { json, getSiteState } from '../_utils.js';
import { guardPublicSim, publicIdentity } from '../_sim-guard.js';
import { deliveryConfigured, ensureEmailTable } from '../_email.js';

// Email Replies (/simulators/email-replies.html): the portal emails a practice scenario to the trainee's own
// inbox; they reply from their inbox; the reply comes back through
// /api/email-inbound and the Email Replies page scores it.
//
//   GET  ?status=1          → { delivery } — whether inbox delivery is set up
//   POST { action: 'send', emailId, to, who }
//                           → { token } — sends scenario emailId to `to`
//   GET  ?token=…           → { status: 'waiting' | 'replied', reply, … }
//
// Only the fixed scenarios in /simulators/reply-packs/emails.json can be sent
// (never text supplied by the visitor), with per-connection and per-address
// limits, so the endpoint can't be used to send arbitrary mail.
//
// Settings (Cloudflare Pages → Settings → Variables and Secrets):
//   POSTMARK_SERVER_TOKEN   Postmark server API token (secret)
//   EMAIL_FROM              verified sender, e.g. "LSH Training Portal <training@yourdomain.com>"
//   EMAIL_INBOUND_ADDRESS   the Postmark inbound address, e.g. 1a2b3c…@inbound.postmarkapp.com
//   EMAIL_INBOUND_SECRET    a long random string; also used in the inbound webhook URL
//   EMAIL_DAILY_PER_ADDRESS optional, default 5 practice emails per address per day
const PACK_PATH = '/simulators/reply-packs/emails.json';

async function loadScenario(request, env, emailId) {
    const res = await env.ASSETS.fetch(new URL(PACK_PATH, request.url));
    if (!res.ok) throw new Error('Could not load the practice emails.');
    const pack = await res.json();
    return (pack.emails || []).find(e => e.id === emailId) || null;
}

function isEmail(s) { return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/.test(s); }

function renderText(e, who) {
    const lines = [
        '[LSH Training Portal — practice email]',
        'This is a training scenario, not a real case. Reply to this email the way you would at work; your reply is scored on the LSH Training Portal.',
        '',
        `From: ${e.from.name} <${e.from.email}> — ${e.from.role}`,
        `Subject: ${e.subject}`
    ];
    if (e.attachments && e.attachments.length) lines.push(`Attachments: ${e.attachments.join(', ')}`);
    lines.push('', e.body, '', '—',
        `You received this because ${who.name || 'someone'} asked for a practice email on the LSH Training Portal. If that wasn't you, ignore this message.`);
    return lines.join('\n');
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const state = await getSiteState(env.DB);
    if (state.locked) return json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423);
    if (url.searchParams.get('status')) return json({ success: true, delivery: deliveryConfigured(env) });

    const token = String(url.searchParams.get('token') || '');
    if (!/^[a-f0-9]{32}$/.test(token)) return json({ success: false, error: 'Unknown practice email.' }, 404);
    try {
        await ensureEmailTable(env.TRAINING_DB);
        const row = await env.TRAINING_DB.prepare(`SELECT email_id, sent_at, reply_text, reply_from, replied_at FROM email_practice WHERE token = ?`).bind(token).first();
        if (!row) return json({ success: false, error: 'Unknown practice email.' }, 404);
        return json({ success: true, emailId: row.email_id, sentAt: row.sent_at,
            status: row.replied_at ? 'replied' : 'waiting', reply: row.reply_text || null, replyFrom: row.reply_from || null, repliedAt: row.replied_at || null },
            200, { 'Cache-Control': 'no-store' });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const blocked = await guardPublicSim(request, env);
    if (blocked) return blocked;
    if (!deliveryConfigured(env)) return json({ success: false, error: 'Inbox delivery isn’t set up on this portal yet — use “Answer here” instead.' }, 503);

    let body;
    try { body = await request.json(); } catch (e) { return json({ success: false, error: 'Invalid request body.' }, 400); }
    if (body.action !== 'send') return json({ success: false, error: 'Unknown action.' }, 400);
    const to = String(body.to || '').trim().toLowerCase().slice(0, 200);
    if (!isEmail(to)) return json({ success: false, error: 'Enter a valid email address.' }, 400);
    const who = publicIdentity(body);

    try {
        const e = await loadScenario(request, env, String(body.emailId || ''));
        if (!e) return json({ success: false, error: 'Unknown practice email.' }, 404);

        const db = env.TRAINING_DB;
        await ensureEmailTable(db);
        const perDay = Math.max(1, Number(env.EMAIL_DAILY_PER_ADDRESS) || 5);
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const count = await db.prepare(`SELECT COUNT(*) AS n FROM email_practice WHERE to_addr = ? AND sent_at > ?`).bind(to, since).first();
        if (count && count.n >= perDay) return json({ success: false, error: `That address already got ${perDay} practice emails today. Try again tomorrow, or use “Answer here”.` }, 429);

        const token = crypto.randomUUID().replace(/-/g, '');
        const [local, domain] = String(env.EMAIL_INBOUND_ADDRESS).split('@');
        const replyTo = `${local}+${token}@${domain}`;

        // Record it first, so a fast reply always finds its row.
        await db.prepare(`INSERT INTO email_practice (token, email_id, to_addr, who_name, who_batch, program, sent_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(token, e.id, to, who.name || null, who.batch || null, who.program || null, new Date().toISOString(),
                  request.headers.get('CF-Connecting-IP') || null)
            .run();
        const res = await fetch('https://api.postmarkapp.com/email', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN },
            body: JSON.stringify({
                From: env.EMAIL_FROM, To: to, ReplyTo: replyTo,
                Subject: `[Practice] ${e.subject}`,
                TextBody: renderText(e, who),
                MessageStream: 'outbound',
                Tag: 'email-practice'
            })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || (data.ErrorCode && data.ErrorCode !== 0)) {
            console.error('email-practice: Postmark error', res.status, JSON.stringify(data));
            await db.prepare(`DELETE FROM email_practice WHERE token = ?`).bind(token).run();
            return json({ success: false, error: `The email service refused the message (${data.Message || res.status}).` }, 502);
        }

        return json({ success: true, token });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

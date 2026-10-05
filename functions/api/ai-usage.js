import { requireSession } from '../_utils.js';
import { usageSummary, MODULES } from '../_ai-gateway.js';

// Admin-only page: today's use of the shared AI budget, flow by flow (the AI gateway, functions/_ai-gateway.js).
// GET /api/ai-usage   (signed in as an admin)
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAMES = { standard: 'Standard', cms: 'CMS', reception: 'Reception', intake: 'Intake', calendaring: 'Calendaring', 'ea-pa': 'EA / PA', pd: 'Property Damage', medsum: 'Med Sum & Demand', portal: 'Other Portal tools' };
const pct = (a, b) => b ? Math.min(100, Math.round(a * 100 / b)) : 0;
const bar = (v) => `<div style="background:#13295a;border-radius:6px;height:8px;margin-top:4px"><div style="width:${v}%;height:8px;border-radius:6px;background:${v >= 90 ? '#dc2626' : v >= 60 ? '#d97706' : '#16a34a'}"></div></div>`;

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const u = await usageSummary(env.TRAINING_DB, env);
    const by = Object.fromEntries(u.today.map(r => [r.module, r]));
    const rows = MODULES.map(m => by[m] || { module: m, calls: 0, tokens: 0, errors: 0, refused: 0 });
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AI usage</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#081226;color:#fff;padding:32px 20px;max-width:860px;margin:0 auto">
<h1 style="font-size:20px">Shared AI budget: ${esc(u.day)}</h1>
<p style="color:#cbd5e1;font-size:13px">Every call flow draws from the same ${u.keys} Gemini key${u.keys === 1 ? '' : 's'} held on the Portal. One flow can use at most ${Math.round(u.limits.moduleShare * 100)}% of the day, so none starves the others. Limits: ${u.limits.dailyCalls.toLocaleString()} requests and ${u.limits.dailyTokens.toLocaleString()} tokens a day, ${u.limits.minuteCalls} requests a minute, ${u.limits.user10} per person every 10 minutes (change them with the AI_* variables on the Portal).</p>
<div style="background:#0f2148;border-radius:12px;padding:14px 16px;margin:12px 0"><b>All flows today</b>: ${u.total.calls.toLocaleString()} of ${u.limits.dailyCalls.toLocaleString()} requests, ${u.total.tokens.toLocaleString()} of ${u.limits.dailyTokens.toLocaleString()} tokens${bar(Math.max(pct(u.total.calls, u.limits.dailyCalls), pct(u.total.tokens, u.limits.dailyTokens)))}</div>
<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#cbd5e1"><th style="padding:8px">Call flow</th><th>Requests</th><th>Tokens</th><th>Share of the day</th><th>Errors</th><th>Held back</th></tr></thead><tbody>
${rows.map(r => `<tr style="border-top:1px solid #1e3a6e"><td style="padding:8px;font-weight:700">${esc(NAMES[r.module] || r.module)}</td><td>${r.calls.toLocaleString()}</td><td>${r.tokens.toLocaleString()}</td><td style="min-width:120px">${pct(r.calls, Math.max(1, u.total.calls))}%${bar(pct(r.calls, Math.max(1, u.total.calls)))}</td><td>${r.errors}</td><td>${r.refused}</td></tr>`).join('')}
</tbody></table>
<h2 style="font-size:15px;margin-top:24px">Last 7 days</h2>
<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${u.week.map(w => `<tr style="border-top:1px solid #1e3a6e"><td style="padding:6px">${esc(w.day)}</td><td>${(w.calls || 0).toLocaleString()} requests</td><td>${(w.tokens || 0).toLocaleString()} tokens</td></tr>`).join('') || '<tr><td style="padding:6px;color:#cbd5e1">No calls yet.</td></tr>'}</tbody></table>
<p><a href="/programs.html" style="color:#f97316;font-weight:700">&larr; Back to the Training Directory</a></p></body></html>`;
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
}

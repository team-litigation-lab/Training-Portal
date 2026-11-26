import { requireSession } from '../_utils.js';
import { usageSummary, MODULES } from '../_ai-gateway.js';
import { controlRoomPage } from '../_control-room.js';

// Admin-only page: today's use of the shared AI budget, flow by flow (the AI gateway, functions/_ai-gateway.js).
// GET /api/ai-usage   (signed in as an admin)
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NAMES = { standard: 'Standard', cms: 'CMS', reception: 'Reception', intake: 'Intake', calendaring: 'Calendaring', 'ea-pa': 'EA / PA', pd: 'Property Damage', medsum: 'Med Sum & Demand', portal: 'Other Portal tools' };
const pct = (a, b) => b ? Math.min(100, Math.round(a * 100 / b)) : 0;
const bar = (v) => `<div class="cr-bar"><i style="width:${v}%;background:${v >= 90 ? '#dc2626' : v >= 60 ? '#d97706' : '#16a34a'}"></i></div>`;

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const u = await usageSummary(env.TRAINING_DB, env);
    const by = Object.fromEntries(u.today.map(r => [r.module, r]));
    const rows = MODULES.map(m => by[m] || { module: m, calls: 0, tokens: 0, errors: 0, refused: 0 });
    const top = Math.max(pct(u.total.calls, u.limits.dailyCalls), pct(u.total.tokens, u.limits.dailyTokens));
    const html = controlRoomPage('AI usage', 'System Management · Control 03 · AI Usage Monitoring', `Shared AI budget: ${esc(u.day)}`,
        `Every call flow draws from the same ${u.keys} Gemini key${u.keys === 1 ? '' : 's'} held on the Portal. One flow can use at most ${Math.round(u.limits.moduleShare * 100)}% of the day, so none starves the others. Limits: ${u.limits.dailyCalls.toLocaleString()} requests and ${u.limits.dailyTokens.toLocaleString()} tokens a day, ${u.limits.minuteCalls} requests a minute, ${u.limits.user10} per person every 10 minutes (change them with the AI_* variables on the Portal).`,
        `<div class="cr-kpis">
<div class="cr-kpi"><span>Requests today</span><b>${u.total.calls.toLocaleString()}</b><small>of ${u.limits.dailyCalls.toLocaleString()}</small></div>
<div class="cr-kpi"><span>Tokens today</span><b>${u.total.tokens.toLocaleString()}</b><small>of ${u.limits.dailyTokens.toLocaleString()}</small></div>
<div class="cr-kpi"><span>All flows today</span><b>${top}%</b><small>of the day's budget</small>${bar(top)}</div></div>
<section class="cr-group"><div class="topic-group-head"><h2>Today, flow by flow</h2></div>
<div class="cr-panel"><div class="cr-scroll"><table class="cr-table"><thead><tr><th>Call flow</th><th>Requests</th><th>Tokens</th><th>Share of the day</th><th>Errors</th><th>Held back</th></tr></thead><tbody>
${rows.map(r => `<tr><td class="nm">${esc(NAMES[r.module] || r.module)}</td><td>${r.calls.toLocaleString()}</td><td>${r.tokens.toLocaleString()}</td><td style="min-width:120px">${pct(r.calls, Math.max(1, u.total.calls))}%${bar(pct(r.calls, Math.max(1, u.total.calls)))}</td><td>${r.errors}</td><td>${r.refused}</td></tr>`).join('')}
</tbody></table></div></div></section>
<section class="cr-group"><div class="topic-group-head"><h2>Last 7 days</h2></div>
<div class="cr-panel"><div class="cr-scroll"><table class="cr-table"><tbody>${u.week.map(w => `<tr><td class="nm">${esc(w.day)}</td><td>${(w.calls || 0).toLocaleString()} requests</td><td>${(w.tokens || 0).toLocaleString()} tokens</td></tr>`).join('') || '<tr><td>No calls yet.</td></tr>'}</tbody></table></div></div></section>
<p class="cr-note"><a href="/system.html" style="color:#c2410c">&larr; Back to System Management</a></p>`);
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
}

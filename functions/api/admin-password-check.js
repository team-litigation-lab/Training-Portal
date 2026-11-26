import { requireSession, verifyMasterCredentials, MASTER_USERNAME } from '../_utils.js';
import { SSO_PROGRAMS, SSO_TOOLS } from './launch.js';
import { controlRoomPage } from '../_control-room.js';

// Admin-only: does every platform accept the admin password?
//
// GET  /api/admin-password-check   a page with one password box
// POST /api/admin-password-check   password=…  → the same page with a line per platform
//
// An admin types the Portal's admin password (MASTER_ADMIN_PASSWORD) once. This sends it, server to server over HTTPS, to each
// platform's own admin sign-in and lists what each said:
//   OK         the platform accepts it
//   INCORRECT  the platform has a different MASTER_ADMIN_PASSWORD from the one typed (fix the secret there)
//   NOT SET    the platform has no MASTER_ADMIN_PASSWORD yet
// Nothing is stored and the password is never shown back. Use it after setting or changing the secret on a platform.
const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLOR = { ok: '#16a34a', bad: '#dc2626', warn: '#d97706' };
const NAMES = { 'STANDARD TRAINING': 'Standard Training', 'EA  PA TRAINING-OUTSOURCED MANP': 'EA / PA Training', 'CM TRAINING': 'Case Management Training', 'PROPERTY DAMAGE': 'Property Damage', 'MEDSUM AND DEMAND': 'Med Sum & Demand', 'LIEN NEGOTIATION': 'Lien Negotiator Training', 'SETTLEMENTS CLOSING': 'Closing Specialist Training' };

async function ask(url, body) {
    try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { status: res.status, body: await res.json().catch(() => null) };
    } catch (e) { return { error: String(e && e.message || e) }; }
}
const verdict = (r, okTest, notSetStatuses) => {
    if (r.error) return ['UNREACHABLE', 'warn', r.error];
    if (okTest(r)) return ['OK', 'ok', 'Accepts the admin password.'];
    if (r.status === 401) return ['INCORRECT', 'bad', 'Its MASTER_ADMIN_PASSWORD is different from the one you typed. Set the same value there (Settings → Variables and Secrets) and redeploy.'];
    if (notSetStatuses.includes(r.status)) return ['NOT SET', 'bad', 'It has no MASTER_ADMIN_PASSWORD yet. Add it as a Secret there and redeploy.'];
    if (r.status === 429) return ['TOO MANY TRIES', 'warn', 'Wait 10 minutes and check again.'];
    return ['UNEXPECTED (' + r.status + ')', 'warn', (r.body && r.body.error) || ''];
};

function page(rows, note) {
    return controlRoomPage('Admin password check', 'System Management · Control 01 · Access', 'Admin password check',
        'Type the admin password once. Each platform is asked whether it accepts it, so you can see which one has a different <b>MASTER_ADMIN_PASSWORD</b>. Nothing is stored and the password is not shown again.',
        `<div class="cr-panel"><form method="POST" class="cr-pw-form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0"><input type="password" name="password" autocomplete="off" placeholder="Admin password" required style="padding:10px 12px;border-radius:10px;border:1.5px solid #94a3b8;width:280px;max-width:100%;font:inherit;font-size:15px">
<button type="submit" class="cr-go">Check every platform <span class="arr">→</span></button></form>
${note ? `<p style="color:#b45309;font-weight:700;margin:10px 0 0">${esc(note)}</p>` : ''}</div>
${rows.length ? `<section class="cr-group"><div class="topic-group-head"><h2>Every platform</h2></div>
${rows.map(r => `<div class="cr-panel" style="box-shadow:inset 6px 0 0 ${COLOR[r.v[1]]};padding-left:22px;margin-bottom:12px">
<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;font-weight:800;color:#1E2340"><span>${esc(r.name)}</span><span style="color:${COLOR[r.v[1]]}">${esc(r.v[0])}</span></div>
<div style="font-size:12.5px;color:#475569;margin-top:4px;overflow-wrap:anywhere">${esc(r.url)}<br>${esc(r.v[2])}</div></div>`).join('')}</section>` : ''}
<p class="cr-note"><a href="/system.html" style="color:#c2410c">&larr; Back to System Management</a></p>`,
        '<script src="/show-password.js?v=1"></script>');
}
const html = (body) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    return html(page([], ''));
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;
    const origin = request.headers.get('Origin');
    if (origin && new URL(origin).host !== new URL(request.url).host) return new Response('Cross-site request refused.', { status: 403 });
    const form = await request.formData().catch(() => null);
    const password = String((form && form.get('password')) || '').trim();
    if (!password) return html(page([], 'Type the admin password first.'));

    const rows = [];
    // this Portal
    rows.push({ name: 'The Portal', url: new URL(request.url).origin + '/', v: !String(env.MASTER_ADMIN_PASSWORD || '').trim()
        ? ['NOT SET', 'bad', 'The Portal has no MASTER_ADMIN_PASSWORD.']
        : verifyMasterCredentials(env, MASTER_USERNAME, password) ? ['OK', 'ok', 'Accepts the admin password.'] : ['INCORRECT', 'bad', 'This is not the Portal\'s MASTER_ADMIN_PASSWORD, so the other results below compare against the wrong password.'] });
    // the five programs
    const jobs = Object.entries(SSO_PROGRAMS).map(async ([key, url]) => {
        const r = await ask(url + 'api/auth/admin', { passphrase: password });
        return { name: NAMES[key] || key, url, v: verdict(r, x => x.status === 200 && x.body && x.body.token, [501]) };
    });
    // the CMS (no username = the Master Account)
    jobs.push((async () => {
        const url = SSO_TOOLS.cms, r = await ask(url + 'api/login', { portalMode: 'Admin', password });
        return { name: 'CMS', url, v: verdict(r, x => x.status === 200 && x.body && x.body.success, [503]) };
    })());
    // the Knowledge Base (it asks the Portal, so this also tests that link)
    jobs.push((async () => {
        const url = SSO_TOOLS.kb, r = await ask(url + 'api/session', { action: 'admin-login', username: MASTER_USERNAME, password });
        return { name: 'LSH Atlas', url, v: verdict(r, x => x.status === 200 && x.body && x.body.success, []) };
    })());
    rows.push(...await Promise.all(jobs));
    return html(page(rows, ''));
}

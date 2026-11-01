import { json } from '../_utils.js';
import { onRequestGet as siteState } from './site-state.js';
import { onRequestGet as alert } from './alert.js';
import { onRequestGet as pings } from './pings.js';
import { onRequestGet as pendingRegs } from './pending-registrations.js';

// GET /api/live[?pings=1&since=<fired_at>]: what every open page checks, in one request:
//   siteState  the lock and pause (GET /api/site-state)
//   alert      the active alert, if any (GET /api/alert)
//   pings      new pings for the signed-in user (GET /api/pings; only with ?pings=1, null when not signed in)
//   pending    registrations waiting for approval, for the ⏳ approval popup (GET /api/pending-registrations;
//              only with ?pending=1, which portal.js sends for a signed-in trainer; null for anyone else)
// portal.js asks every 20 s (every 60 s in a background tab). Every request that runs a Function counts
// toward the Cloudflare account's monthly requests (shared by every LSH site), and this used to be three
// requests every 3 s from every open page.
export async function onRequestGet(context) {
    const qs = new URL(context.request.url).searchParams;
    const want = qs.get('pings') === '1';
    const wantPending = qs.get('pending') === '1';
    const read = async (res) => (res && res.status === 200 ? res.json().catch(() => null) : null);
    const [s, a, p, r] = await Promise.all([
        siteState(context).then(read).catch(() => null),
        alert(context).then(read).catch(() => null),
        want ? pings(context).then(read).catch(() => null) : null,
        wantPending ? pendingRegs(context).then(read).catch(() => null) : null
    ]);
    return json({ success: true, siteState: s, alert: a, pings: p, pending: r && r.success ? r.pending : null }, 200, { 'Cache-Control': 'no-store' });
}

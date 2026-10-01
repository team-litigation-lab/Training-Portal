import { json } from '../_utils.js';
import { onRequestGet as siteState } from './site-state.js';
import { onRequestGet as alert } from './alert.js';
import { onRequestGet as pings } from './pings.js';

// GET /api/live[?pings=1&since=<fired_at>]: what every open page checks, in one request:
//   siteState  the lock and pause (GET /api/site-state)
//   alert      the active alert, if any (GET /api/alert)
//   pings      new pings for the signed-in user (GET /api/pings; only with ?pings=1, null when not signed in)
// portal.js asks every 20 s (every 60 s in a background tab). Every request that runs a Function counts
// toward the Cloudflare account's monthly requests (shared by every LSH site), and this used to be three
// requests every 3 s from every open page.
export async function onRequestGet(context) {
    const want = new URL(context.request.url).searchParams.get('pings') === '1';
    const read = async (res) => (res && res.status === 200 ? res.json().catch(() => null) : null);
    const [s, a, p] = await Promise.all([
        siteState(context).then(read).catch(() => null),
        alert(context).then(read).catch(() => null),
        want ? pings(context).then(read).catch(() => null) : null
    ]);
    return json({ success: true, siteState: s, alert: a, pings: p }, 200, { 'Cache-Control': 'no-store' });
}

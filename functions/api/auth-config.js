import { json, googleRequired, googleDomain } from '../_utils.js';

// GET /api/auth-config → what the sign-in pages need to draw the 🔐 Google step (google-gate.js): the OAuth client's ID and the
// allowed domain, or google: null while the rule is off (no GOOGLE_CLIENT_ID). Public: a client ID isn't a secret.
export async function onRequestGet({ env }) {
    const google = googleRequired(env) ? { clientId: String(env.GOOGLE_CLIENT_ID).trim(), domain: googleDomain(env) } : null;
    return json({ success: true, google }, 200, { 'Cache-Control': 'no-store' });
}

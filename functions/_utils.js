// Shared helpers for LSH Case Management System Cloudflare Pages Functions.

export function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders }
    });
}

/* =====================================================================
   BASE64URL HELPERS
   ===================================================================== */
function toBase64Url(bytes) {
    let str = '';
    bytes.forEach(b => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}
function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

/* =====================================================================
   SESSION TOKENS
   Signed (HMAC-SHA256), not encrypted — payload is base64url-visible to
   the client but cannot be forged or altered without env.SESSION_SECRET,
   which only the server holds. This replaces trusting whatever the
   client claims about who's logged in.

   REQUIRES an env.SESSION_SECRET to be set:
     wrangler pages secret put SESSION_SECRET
   (or via the Cloudflare Pages dashboard -> Settings -> Environment
   variables, as an encrypted secret, NOT a plain variable).
   ===================================================================== */
async function getHmacKey(secret) {
    if (!secret) throw new Error('SESSION_SECRET is not configured.');
    const enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(payload, secret, ttlSeconds = 43200 /* 12h */) {
    const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
    const encodedBody = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
    const key = await getHmacKey(secret);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedBody));
    return `${encodedBody}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token, secret) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [encodedBody, encodedSig] = token.split('.');
    if (!encodedBody || !encodedSig) return null;
    try {
        const key = await getHmacKey(secret);
        const expectedSig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedBody)));
        const providedSig = fromBase64Url(encodedSig);
        if (!constantTimeEqual(expectedSig, providedSig)) return null;
        const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedBody)));
        if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

export function getCookie(request, name) {
    const header = request.headers.get('Cookie') || '';
    const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
export function sessionCookie(token, maxAgeSeconds) {
    return `lsh_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
export function clearSessionCookie() {
    return `lsh_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/**
 * Client heartbeat interval is 2s, but this window needs to survive
 * realistic browser behavior, not just the nominal interval: most
 * browsers throttle setInterval() timers in backgrounded tabs — often
 * down to once every several seconds, and much further after a few
 * minutes backgrounded. A trainee alt-tabbing to check something else for
 * under a minute is completely normal, not a dead session. A 6-second
 * window (3x the nominal interval) died on exactly that, intermittently,
 * which is why this looked like "sometimes it just doesn't work" rather
 * than a consistent failure. Widened to comfortably outlast normal
 * backgrounding while still catching a genuinely closed/crashed tab
 * reasonably quickly.
 */
export const HEARTBEAT_GRACE_SECONDS = 90;

/**
 * True when the user's heartbeats row was touched within the grace window.
 * Sessions without a recent heartbeat are expired even if the signed cookie
 * has not reached its Max-Age yet (tab/browser close, idle timeout, etc.).
 */
export async function isSessionHeartbeatAlive(db, username) {
    const row = await db.prepare(
        `SELECT 1 AS ok FROM heartbeats
         WHERE username = ?
         AND datetime(last_seen) >= datetime('now', ?)`
    ).bind(username, `-${HEARTBEAT_GRACE_SECONDS} seconds`).first();
    return !!row;
}

export async function upsertSessionHeartbeat(db, { username, fullName, batchId, userType, currentCase = null }) {
    await db.prepare(
        `INSERT INTO heartbeats (username, full_name, batch_id, user_type, current_case, last_seen)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(username) DO UPDATE SET
           full_name = excluded.full_name, batch_id = excluded.batch_id,
           user_type = excluded.user_type, current_case = excluded.current_case,
           last_seen = excluded.last_seen`
    ).bind(username, fullName || username, batchId || null, userType || null, currentCase).run();
}

/**
 * Verifies the caller's session cookie. Use this at the top of any
 * endpoint that returns or mutates real data — never trust a
 * username/batchId/userType sent in the request body or query string.
 */
export async function requireSession(request, env, { adminOnly = false } = {}) {
    const token = getCookie(request, 'lsh_session');
    const payload = await verifySessionToken(token, env.SESSION_SECRET);
    if (!payload) {
        return { ok: false, response: json({ success: false, error: 'Not authenticated.', code: 'NOT_AUTHENTICATED' }, 401) };
    }
    // A site-wide Lock blocks all API access, even for an otherwise-valid
    // session — checked before the heartbeat check below so a heartbeat
    // re-seeded by a login attempted mid-lockout can't slip past it. Only
    // site-state.js's UNLOCK action can clear this, and it bypasses
    // requireSession entirely (see that file) since a locked-out admin has
    // no valid session left to check.
    const state = await getSiteState(env.DB);
    if (state.locked) {
        return { ok: false, response: json({ success: false, error: 'This page has been locked by an administrator.', code: 'SITE_LOCKED' }, 423) };
    }
    const alive = await isSessionHeartbeatAlive(env.DB, payload.username);
    if (!alive) {
        return { ok: false, response: json({ success: false, error: 'Session expired.', code: 'SESSION_EXPIRED' }, 401) };
    }
    const liveUser = await env.DB.prepare(`SELECT status FROM users WHERE username = ?`).bind(payload.username).first();
    if (!liveUser || liveUser.status !== 'Approved') {
        return { ok: false, response: json({ success: false, error: 'Your access has been revoked.', code: 'ACCESS_REVOKED' }, 401) };
    }
    if (adminOnly && payload.userType !== 'Admin') {
        return { ok: false, response: json({ success: false, error: 'Admin access required.' }, 403) };
    }
    return { ok: true, session: payload };
}

export async function getSiteState(db) {
    const row = await db.prepare(`SELECT locked, locked_by_batch, paused FROM site_state WHERE id = 1`).first();
    return {
        locked: !!(row && row.locked),
        lockedBy: row ? row.locked_by_batch : null,
        paused: !!(row && row.paused)
    };
}

/* =====================================================================
   MASTER ACCOUNT
   ===================================================================== */
export const MASTER_USERNAME = 'LSHADMIN123';

/** True if this session belongs to the one, un-revokable Master Account. */
export function isMaster(session) {
    return !!session && session.username === MASTER_USERNAME;
}

/**
 * Verifies Master Account credentials for Lock/Unlock — the ONLY two
 * actions the Master Account is used for now that it can no longer
 * complete a normal login (see login.js). Checked against
 * env.MASTER_ADMIN_PASSWORD (a Cloudflare Pages secret), never against the
 * users table — the Master Account has no row there and no session is ever
 * created for it, so there's nothing in the DB to check against. This is
 * also why Lock's own gate can no longer be isMaster(session): a session
 * can never belong to Master, so that check would make Lock unreachable
 * by anyone. Instead, any admin can open the Lock confirmation step, but
 * only Master's own credentials succeed here.
 */
export function verifyMasterCredentials(env, username, password) {
    if (username !== MASTER_USERNAME) return false;
    const want = normalizePassword(env.MASTER_ADMIN_PASSWORD);
    if (!want) {
        console.error('MASTER_ADMIN_PASSWORD is not configured — refusing master credential check.');
        return false;
    }
    const given = normalizePassword(password);
    return !!given && constantTimeEqual(new TextEncoder().encode(given), new TextEncoder().encode(want));
}

/**
 * The admin password is compared as a person types it, on every LSH platform: without spaces or line breaks around it, quotes
 * pasted around the whole password, invisible characters (zero-width spaces, soft hyphens) or curly quotes and long dashes. A
 * secret pasted into Cloudflare with any of these works from a saved (autofilled) password but could never be typed.
 */
export function normalizePassword(v) {
    const t = String(v == null ? '' : v).normalize('NFKC').replace(/[\u00AD\u180E\u200B-\u200F\u2028-\u202F\u205F-\u206F\uFEFF]/g, '')
        .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"').replace(/[\u2010-\u2015\u2212]/g, '-').trim();
    const q = t.match(/^(["'`])([\s\S]*)\1$/);
    return q ? q[2].trim() : t;
}

/**
 * Builds a person's display name from their users-table row fields.
 */
export function buildFullName(user) {
    if (!user) return '';
    return [user.first_name, user.mi ? user.mi.replace(/\.$/, '') + '.' : '', user.last_name].filter(Boolean).join(' ')
        + (user.suffix ? ', ' + user.suffix : '');
}

/* =====================================================================
   PASSWORD HASHING (PBKDF2-SHA256 via Web Crypto)
   ===================================================================== */
async function pbkdf2(password, saltBytes, iterations) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    return new Uint8Array(bits);
}

export async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 100000;
    const hashBytes = await pbkdf2(password, salt, iterations);
    return `pbkdf2:${iterations}:${toBase64Url(salt)}:${toBase64Url(hashBytes)}`;
}

export async function verifyPassword(password, stored) {
    if (!stored) return false;
    if (!stored.startsWith('pbkdf2:')) {
        return stored === password;
    }
    const parts = stored.split(':');
    if (parts.length !== 4) return false;
    const [, iterStr, saltB64, hashB64] = parts;
    const iterations = parseInt(iterStr, 10);
    const salt = fromBase64Url(saltB64);
    const expected = fromBase64Url(hashB64);
    const actual = await pbkdf2(password, salt, iterations);
    return constantTimeEqual(actual, expected);
}

export function isLegacyPlaintext(stored) {
    return !!stored && !stored.startsWith('pbkdf2:');
}

export async function upgradePasswordHash(db, userId, plainPassword) {
    try {
        const newHash = await hashPassword(plainPassword);
        await db.prepare(`UPDATE users SET password = ? WHERE id = ?`).bind(newHash, userId).run();
    } catch (e) {
        console.error('password upgrade failed', e);
    }
}

/* =====================================================================
   SIGN-IN THROTTLE
   Ten wrong passwords for one username from one connection in 10 minutes, then a wait. Per username AND connection,
   so a whole office signing in from one address is never held up by one person's typos.
   ===================================================================== */
const LOGIN_FAIL_LIMIT = 10;
const loginKey = (request, username) => String(username || '').toLowerCase().slice(0, 80) + '|' + (request.headers.get('CF-Connecting-IP') || 'local');
const loginBucket = () => Math.floor(Date.now() / 600000);
async function ensureLoginTable(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS login_failures (k TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (k, bucket))`).run();
}
export async function loginBlocked(db, request, username) {
    try {
        await ensureLoginTable(db);
        const row = await db.prepare(`SELECT COALESCE(SUM(hits), 0) AS n FROM login_failures WHERE k = ? AND bucket >= ?`).bind(loginKey(request, username), loginBucket() - 1).first();
        return !!(row && row.n >= LOGIN_FAIL_LIMIT);
    } catch (e) {
        return false;   // never lock people out because the counter failed
    }
}
export async function loginFailed(db, request, username) {
    try {
        await ensureLoginTable(db);
        const b = loginBucket();
        await db.prepare(`INSERT INTO login_failures (k, bucket, hits) VALUES (?, ?, 1) ON CONFLICT(k, bucket) DO UPDATE SET hits = hits + 1`).bind(loginKey(request, username), b).run();
        if (Math.random() < 0.05) await db.prepare(`DELETE FROM login_failures WHERE bucket < ?`).bind(b - 2).run();
    } catch (e) { /* best effort */ }
}

/* =====================================================================
   BATCH ID / CREDENTIAL HELPERS
   ===================================================================== */
// A new account's Batch ID: B + MMDDYY of the batch's start date (an Admin's: the day the account was made), e.g.
// B100526 for 5 October 2026. It's the batch's, shared by everyone in it: there's no trainee number any more (Batch
// IDs given out before as B<DDMMYYYY>-LSH<TYPE>-<NNN> keep it in storage, since the programs know those trainees by
// it; the pages show them without it, app.js batchLabel). db is no longer needed (the batch_id_counter table that
// numbered them isn't used), kept for the callers.
export async function nextBatchId(db, userType, referenceDate) {
    const d = referenceDate ? new Date(referenceDate) : new Date();
    const when = isNaN(d) ? new Date() : d;
    const p = (n) => String(n).padStart(2, '0');
    return `B${p(when.getUTCMonth() + 1)}${p(when.getUTCDate())}${String(when.getUTCFullYear()).slice(-2)}`;
}

/* =====================================================================
   PERMANENT REVOCATION / TOMBSTONE
   ===================================================================== */
export async function tombstoneUser(db, user, deletedByUsername) {
    const fullName = [user.first_name, user.mi, user.last_name].filter(Boolean).join(' ');
    await db.prepare(
        `INSERT INTO deleted_users (username, user_type, batch_id, email, full_name, deleted_by, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(user.username, user.user_type, user.batch_id || null, user.email || null, fullName, deletedByUsername || null).run();
}

export async function isUsernameTombstoned(db, username) {
    const row = await db.prepare(`SELECT 1 AS ok FROM deleted_users WHERE username = ? LIMIT 1`).bind(username).first();
    return !!row;
}

/* =====================================================================
   ACTIVITY LOGGING
   ===================================================================== */

/**
 * Existing general activity logger — writes to whichever DB is passed.
 * Used by login.js, register.js, and admin access controls (writes to env.DB).
 */
export async function logActivity(db, actorUsername, actorBatch, action, details) {
    try {
        await db.prepare(
            `INSERT INTO activity_log (actor_username, actor_batch, action, details) VALUES (?, ?, ?, ?)`
        ).bind(actorUsername || null, actorBatch || null, action, details ? JSON.stringify(details) : null).run();
    } catch (e) {
        console.error('activity log failed', e);
    }
}

/**
 * AI-Assisted Review (Gemini) — generates trainee-facing commentary + a
 * Key to Correction, and admin-facing commentary + insights + a grading
 * suggestion, for a single submission. Called two ways: automatically
 * right after a trainee submits (see submissions.js, fired via
 * context.waitUntil so it doesn't add latency to their submit response),
 * and on-demand from functions/api/ai-review.js when an admin wants to
 * regenerate it.
 *
 * Uses env.GEMINI_API_KEY1 if set (grading's own key, so it doesn't compete with the
 * simulators, which use GEMINI_API_KEY), otherwise env.GEMINI_API_KEY.
 * Requires one of them (a Cloudflare Pages secret) to do anything —
 * silently no-ops without it, so the rest of the app works normally even
 * before that's configured.
 *
 * Model name is deliberately read from env.GEMINI_MODEL with a fallback,
 * not hardcoded bare — Google has deprecated/retired Gemini model IDs
 * several times within a single year (2.0 Flash retired, 2.5 Flash pulled
 * ahead of its own posted deprecation date), so this needs to be
 * update-able without a code change if the default one below stops
 * working. Check https://ai.google.dev/gemini-api/docs/models for the
 * current list if this starts failing.
 */
export async function generateAiReview(env, { submissionId, activityTitle, questions, answers, notes }) {
    // Grading's own key first; if it's rate-limited (429) or rejected, the main key takes the request.
    const keys = [env.GEMINI_API_KEY1, env.GEMINI_API_KEY].filter((k, i, a) => k && a.indexOf(k) === i);
    if (!keys.length) {
        console.error('generateAiReview: GEMINI_API_KEY is not configured — skipping.');
        return { ok: false, error: 'AI review is not configured yet (missing GEMINI_API_KEY).' };
    }
    // Grading starts on the Flash models for quality (GEMINI_MODEL first if set), then Flash-Lite:
    // on the free tier each model has its own quota (Flash 20 a day, Flash-Lite about 500).
    const models = [env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter((v, i, a) => v && a.indexOf(v) === i);

    try {
        const answerByQ = new Map((answers || []).map(a => [a.questionId, a.response]));
        let questionBlock;
        if (Array.isArray(questions) && questions.length > 0) {
            questionBlock = questions.map((q, i) => {
                const given = answerByQ.get(q.id);
                const scenarioLine = q.scenario ? `Scenario: ${q.scenario}\n` : '';
                const answerKeyLine = q.type !== 'essay' ? `Correct answer: ${q.correctAnswer || ''}` : '(This is an open-ended/essay question — there is no single correct answer.)';
                return `Q${i + 1}: ${q.prompt}\n${scenarioLine}Trainee's answer: ${given !== undefined ? given : '(no response given)'}\n${answerKeyLine}`;
            }).join('\n\n');
        } else {
            questionBlock = `This activity has no structured questions — the trainee submitted the following free-form response:\n${notes || '(no response given)'}`;
        }

        const prompt = `You are an expert reviewer for a legal case-management trainee onboarding program at a legal support company. Review this trainee's submission for the activity "${activityTitle}".

${questionBlock}

Respond ONLY with a JSON object matching this exact shape, with no other text before or after it:
{
  "traineeCommentary": "A supportive, plain-language paragraph (3-5 sentences) written directly to the trainee about their overall performance — professional but encouraging.",
  "keyToCorrection": "For each question the trainee got wrong or left blank, briefly explain the correct answer and the reasoning behind it so they can learn from it. If everything was correct, briefly reinforce why their answers were right.",
  "adminCommentary": "A more technical, detailed assessment for the admin reviewer — what the trainee demonstrated, and where their understanding was weaker.",
  "insights": "Any pattern worth flagging — a recurring misunderstanding, a notable strength, or a suggestion for what this trainee might need extra support with.",
  "gradingSuggestion": "A short rationale for what score you'd suggest and why.",
  "suggestedScore": 0
}
"suggestedScore" must be a plain number from 0 to 100.`;

        let res, errText = '', model = models[0];
        keyLoop:
        for (const apiKey of keys) {
            let limited = false, badKey = false;
            for (model of models) {
                res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: 'application/json' }
                    })
                });
                if (res.ok) break keyLoop;
                errText = await res.text().catch(() => '');
                if (res.status === 429) limited = true;
                if (res.status === 400 && /API key/i.test(errText)) { badKey = true; break; }
                if (![404, 429, 500, 503].includes(res.status)) break keyLoop;   // e.g. a bad request: another model or key won't help
            }
            if (!(limited || badKey)) break;   // only a limit or a bad key is worth the next key
        }

        if (!res.ok) {
            console.error('generateAiReview: Gemini API error', res.status, errText);
            return { ok: false, error: res.status === 429
                ? 'AI generation limit reached. Try again in a minute.'
                : `Gemini API error (${res.status}). The configured model may need updating — see https://ai.google.dev/gemini-api/docs/models.` };
        }

        const data = await res.json();
        const rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
            data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
        if (!rawText) {
            console.error('generateAiReview: no usable content in Gemini response', JSON.stringify(data));
            return { ok: false, error: 'Gemini returned no usable content.' };
        }

        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch (e) {
            console.error('generateAiReview: failed to parse Gemini JSON response', rawText);
            return { ok: false, error: 'Could not parse the AI response.' };
        }

        parsed.generatedAt = new Date().toISOString();

        await env.TRAINING_DB.prepare(`UPDATE submissions SET ai_review = ? WHERE id = ?`)
            .bind(JSON.stringify(parsed), submissionId).run();

        return { ok: true, review: parsed };
    } catch (err) {
        console.error('generateAiReview failed:', err);
        return { ok: false, error: err.message };
    }
}

// A JSON array stored as text (a question list, a trainee's answers): anything else reads as an empty list.
export function parseJsonList(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// base64url of bytes (tickets and signatures).
export function b64url(bytes) {
    return toBase64Url(new Uint8Array(bytes));
}

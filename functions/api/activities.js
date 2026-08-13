import { json, requireSession, logActivity } from '../_utils.js';

const DAY_POOL = ['Day 1', 'Day 2', 'Day 3', 'Day 4'];

function safeParseQuestions(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// Trainees get the question list so they can answer it — but never the
// correctAnswer key, or objective questions would grade themselves in the
// browser dev tools before the trainee even opens the activity.
function sanitizeQuestionsForTrainee(questions) {
    return questions.map(({ correctAnswer, ...rest }) => rest);
}

// Picks whichever fixed training day currently has the fewest activities,
// so new Drafts spread out evenly rather than piling onto whatever day an
// admin happened to add to first. Self-corrects even as items get
// archived later, unlike a stored rotating cursor.
async function assignNextDay(db) {
    const placeholders = DAY_POOL.map(() => '?').join(',');
    const { results } = await db.prepare(
        `SELECT day_label, COUNT(*) as cnt FROM activities WHERE day_label IN (${placeholders}) GROUP BY day_label`
    ).bind(...DAY_POOL).all();

    const counts = Object.fromEntries(DAY_POOL.map(d => [d, 0]));
    (results || []).forEach(r => { counts[r.day_label] = r.cnt; });

    let chosen = DAY_POOL[0];
    for (const d of DAY_POOL) {
        if (counts[d] < counts[chosen]) chosen = d;
    }
    return chosen;
}

// A Published activity whose deadline has passed is Closed in spirit even
// before anyone acts on it. Rather than requiring a separate Cron Trigger,
// this flips the row the moment anyone next reads the activity list.
async function lazyCloseExpired(db, rows) {
    const now = new Date();
    const toClose = rows.filter(r =>
        r.status === 'Published' && !r.open_deadline && r.deadline && new Date(r.deadline) < now
    );
    if (toClose.length === 0) return rows;

    for (const r of toClose) {
        await db.prepare(
            "UPDATE activities SET status = 'Closed', closed_at = datetime('now') WHERE id = ?"
        ).bind(r.id).run();
        r.status = 'Closed';
        r.closed_at = new Date().toISOString();
    }
    return rows;
}

export async function onRequestGet({ request, env }) {
    const auth = await requireSession(request, env);
    if (!auth.ok) return auth.response;

    try {
        const { results } = await env.TRAINING_DB.prepare(
            "SELECT * FROM activities ORDER BY day_label ASC, created_at ASC"
        ).all();

        let rows = results || [];
        rows = await lazyCloseExpired(env.TRAINING_DB, rows);

        const isAdmin = auth.session.userType === 'Admin';

        let activities = rows.map(a => {
            const questions = safeParseQuestions(a.questions);
            return {
                ...a,
                open_deadline: !!a.open_deadline,
                questions: isAdmin ? questions : sanitizeQuestionsForTrainee(questions)
            };
        });

        if (!isAdmin) {
            // Drafts and Unpublished items never existed as far as trainees
            // are concerned — only currently-or-previously-live content shows.
            activities = activities.filter(a => a.status === 'Published' || a.status === 'Closed');
        }

        return json({ success: true, activities });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

export async function onRequestPost({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    const db = env.TRAINING_DB;

    try {
        const body = await request.json();
        const action = body.action || 'CREATE';

        // ---- CREATE: title only. Everything else is filled in later from the edit view. ----
        if (action === 'CREATE') {
            const title = (body.title || '').trim();
            if (!title) return json({ success: false, error: "Title is required." }, 400);

            const dayLabel = await assignNextDay(db);

            const res = await db.prepare(
                `INSERT INTO activities (title, day_label, type, file_url, created_by, questions, status, instructions, open_deadline)
                 VALUES (?, ?, 'Activity', '', ?, '[]', 'Draft', '', 1)`
            ).bind(title, dayLabel, auth.session.username).run();

            await logActivity(db, auth.session.username, auth.session.batchId, 'ACTIVITY_ADDED', { title, dayLabel });

            return json({ success: true, id: res.meta.last_row_id, dayLabel });
        }

        // Every other action operates on an existing activity.
        const id = body.id;
        if (!id) return json({ success: false, error: "Activity ID is required." }, 400);
        const activity = await db.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first();
        if (!activity) return json({ success: false, error: "Activity not found." }, 404);

        const isEditable = activity.status === 'Draft' || activity.status === 'Unpublished';

        // ---- UPDATE: title / instructions / deadline / attached deck ----
        if (action === 'UPDATE') {
            if (!isEditable) {
                return json({ success: false, error: "Published or Closed activities can't be edited. Unpublish it first." }, 403);
            }

            const title = body.title !== undefined ? String(body.title).trim() : activity.title;
            if (!title) return json({ success: false, error: "Title is required." }, 400);

            const instructions = body.instructions !== undefined ? String(body.instructions).slice(0, 8000) : activity.instructions;
            const fileUrl = body.fileUrl !== undefined ? String(body.fileUrl).trim() : activity.file_url;
            const openDeadline = body.openDeadline !== undefined ? (body.openDeadline ? 1 : 0) : activity.open_deadline;
            const deadline = openDeadline ? null : (body.deadline !== undefined ? (body.deadline || null) : activity.deadline);

            await db.prepare(
                `UPDATE activities SET title = ?, instructions = ?, file_url = ?, open_deadline = ?, deadline = ? WHERE id = ?`
            ).bind(title, instructions, fileUrl, openDeadline, deadline, id).run();

            return json({ success: true });
        }

        // ---- ADD_QUESTION: the "+ Add Item" flow — scenario + question ----
        if (action === 'ADD_QUESTION') {
            if (!isEditable) {
                return json({ success: false, error: "Published or Closed activities can't be edited. Unpublish it first." }, 403);
            }

            const q = body.question || {};
            const qType = ['mcq', 'truefalse', 'short', 'essay'].includes(q.type) ? q.type : 'essay';
            const prompt = String(q.prompt || '').trim();
            if (!prompt) return json({ success: false, error: "Question text is required." }, 400);

            const clean = {
                id: `q${Date.now()}${Math.floor(Math.random() * 1000)}`,
                type: qType,
                scenario: String(q.scenario || '').slice(0, 4000),
                prompt: prompt.slice(0, 2000),
                points: Number.isFinite(Number(q.points)) ? Math.max(1, Math.round(Number(q.points))) : 1
            };
            if (qType === 'mcq') {
                clean.choices = Array.isArray(q.choices) ? q.choices.map(c => String(c).slice(0, 500)).filter(Boolean) : [];
            }
            if (qType === 'mcq' || qType === 'truefalse' || qType === 'short') {
                clean.correctAnswer = q.correctAnswer !== undefined ? String(q.correctAnswer) : '';
            }

            const questions = safeParseQuestions(activity.questions);
            questions.push(clean);
            await db.prepare("UPDATE activities SET questions = ? WHERE id = ?").bind(JSON.stringify(questions), id).run();

            return json({ success: true, questions });
        }

        // ---- REMOVE_QUESTION: drop a single item while still editable ----
        if (action === 'REMOVE_QUESTION') {
            if (!isEditable) {
                return json({ success: false, error: "Published or Closed activities can't be edited. Unpublish it first." }, 403);
            }

            const questions = safeParseQuestions(activity.questions).filter(q => q.id !== body.questionId);
            await db.prepare("UPDATE activities SET questions = ? WHERE id = ?").bind(JSON.stringify(questions), id).run();

            return json({ success: true, questions });
        }

        // ---- PUBLISH: Draft or Unpublished -> Published ----
        if (action === 'PUBLISH') {
            if (activity.status !== 'Draft' && activity.status !== 'Unpublished') {
                return json({ success: false, error: "Only Draft or Unpublished activities can be published." }, 403);
            }
            const questions = safeParseQuestions(activity.questions);
            if (questions.length === 0) {
                return json({ success: false, error: "Add at least one item before publishing." }, 400);
            }

            await db.prepare(
                "UPDATE activities SET status = 'Published', published_at = datetime('now') WHERE id = ?"
            ).bind(id).run();

            await logActivity(db, auth.session.username, auth.session.batchId, 'ACTIVITY_PUBLISHED', { title: activity.title });
            return json({ success: true });
        }

        // ---- UNPUBLISH: Published -> Unpublished (re-opens editing) ----
        if (action === 'UNPUBLISH') {
            if (activity.status !== 'Published') {
                return json({ success: false, error: "Only Published activities can be unpublished." }, 403);
            }

            await db.prepare("UPDATE activities SET status = 'Unpublished' WHERE id = ?").bind(id).run();
            await logActivity(db, auth.session.username, auth.session.batchId, 'ACTIVITY_UNPUBLISHED', { title: activity.title });
            return json({ success: true });
        }

        // ---- CLOSE: Draft/Published/Unpublished -> Closed (manual close, or deadline auto-close on GET) ----
        if (action === 'CLOSE') {
            if (activity.status === 'Closed') {
                return json({ success: false, error: "This activity is already closed." }, 403);
            }

            await db.prepare(
                "UPDATE activities SET status = 'Closed', closed_at = datetime('now') WHERE id = ?"
            ).bind(id).run();

            await logActivity(db, auth.session.username, auth.session.batchId, 'ACTIVITY_CLOSED', { title: activity.title });
            return json({ success: true });
        }

        return json({ success: false, error: "Unknown action." }, 400);
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

// Removal only ever archives — it never hard-deletes without a trace.
// Published/Unpublished work has to be Closed first; Closed or still-Draft
// items (never publicly seen) can go straight to the archive.
export async function onRequestDelete({ request, env }) {
    const auth = await requireSession(request, env, { adminOnly: true });
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (!id) return json({ success: false, error: "Activity ID is required." }, 400);

        const db = env.TRAINING_DB;
        const activity = await db.prepare("SELECT * FROM activities WHERE id = ?").bind(id).first();
        if (!activity) return json({ success: false, error: "Activity not found." }, 404);

        if (activity.status !== 'Closed' && activity.status !== 'Draft') {
            return json({ success: false, error: "Close this activity before removing it." }, 403);
        }

        await db.prepare(
            `INSERT INTO activities_archive
                (original_id, title, day_label, type, file_url, questions, instructions, deadline, open_deadline, status, created_by, created_at, published_at, closed_at, archived_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            activity.id, activity.title, activity.day_label, activity.type, activity.file_url,
            activity.questions, activity.instructions, activity.deadline, activity.open_deadline,
            activity.status, activity.created_by, activity.created_at, activity.published_at, activity.closed_at,
            auth.session.username
        ).run();

        await db.prepare("DELETE FROM activities WHERE id = ?").bind(id).run();

        await logActivity(db, auth.session.username, auth.session.batchId, 'ACTIVITY_ARCHIVED', { title: activity.title });

        return json({ success: true });
    } catch (err) {
        return json({ success: false, error: err.message }, 500);
    }
}

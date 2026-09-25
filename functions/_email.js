// Shared by /api/email-practice and /api/email-inbound (Email Replies simulator).
export function deliveryConfigured(env) {
    return !!(env.POSTMARK_SERVER_TOKEN && env.EMAIL_FROM && env.EMAIL_INBOUND_ADDRESS && env.EMAIL_INBOUND_SECRET);
}

export async function ensureEmailTable(db) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS email_practice (
        token TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        who_name TEXT,
        who_batch TEXT,
        program TEXT,
        sent_at TEXT NOT NULL,
        ip TEXT,
        reply_text TEXT,
        reply_from TEXT,
        replied_at TEXT
    )`).run();
}

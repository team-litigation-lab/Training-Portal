/**
 * CM Training Interface — backend server
 * --------------------------------------
 * Implements the two API surfaces the front-end (public/index.html) already calls:
 *
 *   /api/auth/register  POST   create an account (pending admin approval)
 *   /api/auth/login     POST   log in, starts a session cookie
 *   /api/auth/logout    POST   destroy the session
 *   /api/auth/me        GET    return the logged-in user (or 401)
 *
 *   /api/kv/:key        GET    read a value (?shared=1 for the shared/global store)
 *   /api/kv/:key        PUT    write a value ({ value, shared })
 *   /api/kv             GET    list keys by prefix (?prefix=&shared=1)
 *
 *   /api/admin/pending-users   GET   list accounts awaiting approval (admin only)
 *   /api/admin/approve-user    POST  approve an account (admin only)
 *   /api/admin/reject-user     POST  reject/delete a pending account (admin only)
 *
 * Storage: a single JSON file on disk (./data/db.json). No native/compiled
 * dependencies are required, so this runs anywhere Node.js runs. Swap `Store`
 * below for a real database later without touching the routes.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Tiny JSON-file data store
// ---------------------------------------------------------------------------
function emptyDb() {
  return {
    users: [],       // { id, firstName, mi, lastName, suffix, email, role, username, usernameLower, passwordHash, approved, batchId, createdAt }
    kvShared: {},     // { [key]: stringValue }
    kvPrivate: {},    // { [userId]: { [key]: stringValue } }
  };
}

function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(), null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to parse db.json, starting from an empty store:', e);
    return emptyDb();
  }
}

let db = loadDb();

// Writes are synchronous and the whole file is rewritten each time. This is
// simple and safe for a small-scale training app; move to a real database if
// this ever needs to handle heavy concurrent write traffic.
function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function findUserByUsername(username) {
  const lower = String(username || '').trim().toLowerCase();
  return db.users.find(u => u.usernameLower === lower);
}

function findUserById(id) {
  return db.users.find(u => u.id === id);
}

function publicUser(u) {
  const name = [u.firstName, u.mi ? u.mi + '.' : '', u.lastName, u.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    id: u.id,
    name,
    email: u.email,
    role: u.role,
    batchId: u.batchId || null,
    approved: !!u.approved,
  };
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' })); // lesson deck uploads are base64-encoded JSON

app.use(session({
  name: 'cm.sid',
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // requires HTTPS in production
    maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
  },
}));

function requireAuth(req, res, next) {
  const user = req.session.userId && findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

// Key namespaces that only admins are allowed to write to via the shared store.
// (Everyone with a session can still read shared keys — that's the whole point:
// activities an admin uploads/builds become visible to every signed-in user.)
const ADMIN_ONLY_WRITE_PREFIXES = ['activity_meta:', 'activity_items:', 'lesson:', 'grade:', 'config:'];

function assertWriteAllowed(req, key) {
  const prefix = ADMIN_ONLY_WRITE_PREFIXES.find(p => key.startsWith(p));
  if (prefix && req.user.role !== 'admin') {
    return `Only admins can write to "${prefix}" keys.`;
  }
  if (key.startsWith('submission:')) {
    // submission:<day>:<slug> — trainees may only write their own slug.
    const slug = slugify(req.user_displayName || '');
    if (!key.endsWith(':' + slug)) {
      return 'You can only submit your own answers.';
    }
  }
  return null;
}

function slugify(n) {
  return String(n || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '') || 'anonymous';
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { firstName, mi, lastName, suffix, email, role, username, password } = req.body || {};

  if (!firstName || !lastName || !email || !username || !password) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  if (!['trainee', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid account type.' });
  }
  const pwRule = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  if (!pwRule.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers.' });
  }
  if (findUserByUsername(username)) {
    return res.status(400).json({ error: 'That username is already taken.' });
  }

  const user = {
    id: crypto.randomUUID(),
    firstName: String(firstName).trim(),
    mi: String(mi || '').trim(),
    lastName: String(lastName).trim(),
    suffix: String(suffix || '').trim(),
    email: String(email).trim(),
    role,
    username: String(username).trim(),
    usernameLower: String(username).trim().toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    approved: false,
    batchId: null,
    createdAt: Date.now(),
  };
  db.users.push(user);
  db.kvPrivate[user.id] = {};
  persist();

  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = username && findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  if (!user.approved) {
    return res.status(403).json({ error: 'This account is still awaiting admin approval.' });
  }
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  const user = req.session.userId && findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: publicUser(user) });
});

// ---------------------------------------------------------------------------
// Key-value storage routes (shared = visible to every signed-in user;
// private = scoped to the caller only)
// ---------------------------------------------------------------------------
app.get('/api/kv', requireAuth, (req, res) => {
  const prefix = String(req.query.prefix || '');
  const shared = req.query.shared === '1';
  const store = shared ? db.kvShared : (db.kvPrivate[req.user.id] || {});
  const keys = Object.keys(store).filter(k => k.startsWith(prefix));
  res.json({ keys });
});

app.get('/api/kv/:key', requireAuth, (req, res) => {
  const shared = req.query.shared === '1';
  const store = shared ? db.kvShared : (db.kvPrivate[req.user.id] || {});
  const value = Object.prototype.hasOwnProperty.call(store, req.params.key) ? store[req.params.key] : null;
  res.json({ key: req.params.key, value });
});

app.put('/api/kv/:key', requireAuth, (req, res) => {
  const { value, shared } = req.body || {};
  const key = req.params.key;

  // req.user_displayName is used by assertWriteAllowed to check submission ownership.
  req.user_displayName = publicUser(req.user).name;

  if (shared) {
    const denyReason = assertWriteAllowed(req, key);
    if (denyReason) return res.status(403).json({ error: denyReason });
    db.kvShared[key] = value;
  } else {
    if (!db.kvPrivate[req.user.id]) db.kvPrivate[req.user.id] = {};
    db.kvPrivate[req.user.id][key] = value;
  }
  persist();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: approve / reject newly registered accounts
// ---------------------------------------------------------------------------
app.get('/api/admin/pending-users', requireAuth, requireAdmin, (req, res) => {
  const pending = db.users
    .filter(u => !u.approved)
    .map(u => ({ ...publicUser(u), username: u.username, createdAt: u.createdAt }));
  res.json({ users: pending });
});

app.post('/api/admin/approve-user', requireAuth, requireAdmin, (req, res) => {
  const { id, batchId } = req.body || {};
  const user = findUserById(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  user.approved = true;
  if (batchId) user.batchId = String(batchId).trim();
  persist();
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/admin/reject-user', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.body || {};
  const before = db.users.length;
  db.users = db.users.filter(u => u.id !== id);
  delete db.kvPrivate[id];
  if (db.users.length !== before) persist();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Static front-end
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Bootstrap: create a default admin account on first run so there's a way in
// ---------------------------------------------------------------------------
function ensureBootstrapAdmin() {
  const hasAdmin = db.users.some(u => u.role === 'admin');
  if (hasAdmin) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123';
  const admin = {
    id: crypto.randomUUID(),
    firstName: 'System',
    mi: '',
    lastName: 'Administrator',
    suffix: '',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    role: 'admin',
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    approved: true,
    batchId: null,
    createdAt: Date.now(),
  };
  db.users.push(admin);
  db.kvPrivate[admin.id] = {};
  persist();
  console.log('----------------------------------------------------------');
  console.log(' No admin account existed yet, so one was created:');
  console.log(`   username: ${username}`);
  console.log(`   password: ${password}`);
  console.log(' Set ADMIN_USERNAME / ADMIN_PASSWORD env vars to customize,');
  console.log(' and change this password after logging in for the first time.');
  console.log('----------------------------------------------------------');
}

ensureBootstrapAdmin();

app.listen(PORT, () => {
  console.log(`CM Training Interface backend listening on http://localhost:${PORT}`);
});

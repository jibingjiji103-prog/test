import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { INSTITUTE_ID, checkDatabase, databaseConfigured, pool, withTransaction } from './db.js';
import {
  deleteDbUser, deleteRecord, findAuthUser, findUserById, loadState,
  sanitizeDbUser, saveInstituteMeta, saveRecord, saveUserPreferences,
  updateUserPassword, upsertUser,
} from './store.js';
import { hashServerPassword, validatePasswordPolicy, verifyServerPassword } from './password.js';
import { canChangeSettings, canManageUsers, canMutateRecord, canWriteCollection, filterStateForUser } from '../src/lib/permissions.js';
import { applyStateOperation } from './stateOps.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_ISSUER = 'edutrack-crm';
const COOKIE_NAME = 'edutrack_session';
const MUTABLE_COLLECTIONS = new Set(['batches', 'students', 'attendance', 'assessments', 'assessmentResults', 'tasks', 'trainerTasks', 'groups', 'syllabi']);
const ROLES = new Set(['Admin', 'Trainer', 'Read-Only']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : true, credentials: true }));
app.use(express.json({ limit: '6mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function getJwtSecret() {
  if (!process.env.JWT_SECRET) throw Object.assign(new Error('JWT_SECRET is not configured on the server.'), { status: 503 });
  return process.env.JWT_SECRET;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    const key = part.slice(0, index);
    const value = part.slice(index + 1);
    try { return [key, decodeURIComponent(value)]; } catch { return [key, value]; }
  }));
}

function setSessionCookie(res, userId) {
  const token = jwt.sign({ sub: userId, instituteId: INSTITUTE_ID }, getJwtSecret(), {
    expiresIn: '8h', issuer: JWT_ISSUER, audience: 'edutrack-web',
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

async function authenticate(req, res, next) {
  try {
    if (!databaseConfigured || !pool) throw Object.assign(new Error('Database mode is not configured.'), { status: 503 });
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });
    const payload = jwt.verify(token, getJwtSecret(), { issuer: JWT_ISSUER, audience: 'edutrack-web' });
    if (payload.instituteId !== INSTITUTE_ID) throw Object.assign(new Error('Invalid session scope.'), { status: 401 });
    const row = await findUserById(pool, INSTITUTE_ID, payload.sub);
    if (!row || !row.active) throw Object.assign(new Error('Your session is no longer valid.'), { status: 401 });
    req.authUser = sanitizeDbUser(row);
    req.authRow = row;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      next(Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 }));
    } else next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!canManageUsers(req.authUser)) return next(Object.assign(new Error('Administrator permission required.'), { status: 403 }));
  next();
}

function readStateFor(req) {
  return loadState(pool, INSTITUTE_ID, req.authUser.id).then((state) => filterStateForUser(state, req.authUser));
}

const loginAttempts = new Map();
function loginKey(req, email) {
  return `${req.ip || 'unknown'}:${(email || '').toLowerCase()}`;
}
function assertLoginAllowed(req, email) {
  const key = loginKey(req, email);
  const entry = loginAttempts.get(key);
  if (entry && entry.blockedUntil > Date.now()) {
    throw Object.assign(new Error('Too many sign-in attempts. Try again in a few minutes.'), { status: 429 });
  }
}
function recordLoginFailure(req, email) {
  const key = loginKey(req, email);
  const entry = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 6) {
    entry.blockedUntil = Date.now() + 5 * 60 * 1000;
    entry.count = 0;
  }
  loginAttempts.set(key, entry);
}

app.get('/api/health', asyncRoute(async (req, res) => {
  if (!databaseConfigured) {
    return res.json({ status: 'ok', mode: 'unconfigured', database: null, message: 'No DATABASE_URL configured; frontend uses browser demo mode.' });
  }
  try {
    const status = await checkDatabase();
    if (!status.ok) return res.status(503).json({ status: 'error', mode: 'unavailable', error: status.reason });
    return res.json({ status: 'ok', mode: 'database', database: 'PostgreSQL', serverTime: status.serverTime, message: 'JWT + hashed passwords + server-side RBAC are active.' });
  } catch (error) {
    return res.status(503).json({ status: 'error', mode: 'unavailable', error: error.message });
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  if (!databaseConfigured || !pool) return res.status(503).json({ error: 'Database authentication is not configured.' });
  getJwtSecret();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!EMAIL_RE.test(email) || !password) return res.status(400).json({ error: 'Enter a valid email address and password.' });
  assertLoginAllowed(req, email);
  const row = await findAuthUser(pool, INSTITUTE_ID, email);
  const valid = row && row.active && await verifyServerPassword(password, row);
  if (!valid) {
    recordLoginFailure(req, email);
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  loginAttempts.delete(loginKey(req, email));
  setSessionCookie(res, row.id);
  return res.json({ user: sanitizeDbUser(row) });
}));

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.authUser }));

app.post('/api/auth/change-password', authenticate, asyncRoute(async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required.' });
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) return res.status(400).json({ error: policyError });
  if (!await verifyServerPassword(currentPassword, req.authRow)) return res.status(401).json({ error: 'Current password is incorrect.' });
  await updateUserPassword(pool, INSTITUTE_ID, req.authUser.id, await hashServerPassword(newPassword));
  res.json({ ok: true, message: 'Password updated.' });
}));

app.get('/api/state', authenticate, asyncRoute(async (req, res) => {
  const state = await readStateFor(req);
  res.json({ state, mode: 'database' });
}));

app.post('/api/state/mutations', authenticate, asyncRoute(async (req, res) => {
  const operations = req.body?.operations;
  if (!Array.isArray(operations) || operations.length === 0) return res.status(400).json({ error: 'No operations were provided.' });
  if (operations.length > 250) return res.status(413).json({ error: 'Too many operations in one request.' });

  await withTransaction(async (client) => {
    let workingState = await loadState(client, INSTITUTE_ID, req.authUser.id);
    for (const operation of operations) {
      const { collection, action } = operation;
      if (!MUTABLE_COLLECTIONS.has(collection)) throw Object.assign(new Error(`The ${collection} collection cannot be changed through this endpoint.`), { status: 403 });
      if (!['create', 'update', 'delete'].includes(action)) throw Object.assign(new Error('Unsupported mutation action.'), { status: 400 });
      if (!canWriteCollection(req.authUser, collection)) throw Object.assign(new Error('Your role cannot modify this module.'), { status: 403 });

      const existing = workingState[collection]?.find((row) => row.id === (operation.id || operation.record?.id)) || null;
      const record = action === 'delete' ? existing : {
        ...(existing || {}),
        ...(operation.record || {}),
        id: operation.record?.id || operation.id || existing?.id || `${collection.toUpperCase()}-${randomUUID()}`,
      };
      const permission = canMutateRecord(req.authUser, workingState, collection, record, existing);
      if (!permission.allowed) throw Object.assign(new Error(permission.reason), { status: 403 });

      if (action === 'delete') {
        await deleteRecord(client, INSTITUTE_ID, collection, operation.id || operation.record?.id);
        workingState = applyStateOperation(workingState, { collection, action, id: operation.id || operation.record?.id });
      } else {
        await saveRecord(client, INSTITUTE_ID, collection, record);
        workingState = applyStateOperation(workingState, { collection, action: existing ? 'update' : 'create', record, id: record.id });
      }
      await client.query(
        `INSERT INTO audit_logs (id, institute_id, actor_id, action, collection, record_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [randomUUID(), INSTITUTE_ID, req.authUser.id, action, collection, record?.id || operation.id || null, JSON.stringify({ role: req.authUser.role })],
      ).catch(() => {});
    }
  });
  const state = await readStateFor(req);
  res.json({ state, mode: 'database' });
}));

app.put('/api/settings', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (!canChangeSettings(req.authUser)) return res.status(403).json({ error: 'Administrator permission required.' });
  const meta = req.body?.meta || {};
  if (meta.institute && (!meta.institute.name || !EMAIL_RE.test(meta.institute.email || ''))) return res.status(400).json({ error: 'A valid institute name and email are required.' });
  await saveInstituteMeta(pool, INSTITUTE_ID, meta);
  const state = await readStateFor(req);
  res.json({ state, message: 'Settings saved.' });
}));

app.put('/api/preferences', authenticate, asyncRoute(async (req, res) => {
  const incomingPreferences = req.body?.preferences || {};
  const incomingDashboard = req.body?.dashboard || {};
  const allowedKeys = ['theme', 'pageSize', 'dateFormat', 'defaultPassingMarks', 'showDemoLabel', 'compactTables'];
  const preferences = Object.fromEntries(Object.entries(incomingPreferences).filter(([key]) => allowedKeys.includes(key)));
  const dashboard = {
    ...(Array.isArray(incomingDashboard.cards) ? { cards: incomingDashboard.cards.filter((id) => typeof id === 'string') } : {}),
    ...(Array.isArray(incomingDashboard.order) ? { order: incomingDashboard.order.filter((id) => typeof id === 'string') } : {}),
  };
  await saveUserPreferences(pool, req.authUser.id, preferences, dashboard);
  const state = await readStateFor(req);
  res.json({ state, message: 'Preferences saved.' });
}));

app.patch('/api/profile', authenticate, asyncRoute(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  if (!name || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid name and email are required.' });
  const duplicate = await pool.query('SELECT id FROM users WHERE institute_id = $1 AND LOWER(email) = LOWER($2) AND id <> $3 LIMIT 1', [INSTITUTE_ID, email, req.authUser.id]);
  if (duplicate.rows.length) return res.status(409).json({ error: 'That email address is already in use.' });
  await pool.query('UPDATE users SET name=$3,email=$4,phone=$5,updated_at=NOW() WHERE institute_id=$1 AND id=$2', [INSTITUTE_ID, req.authUser.id, name, email, phone || null]);
  const row = await findUserById(pool, INSTITUTE_ID, req.authUser.id);
  res.json({ user: sanitizeDbUser(row), message: 'Profile saved.' });
}));

app.post('/api/users', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || '');
  if (!name || !EMAIL_RE.test(email) || !ROLES.has(role)) return res.status(400).json({ error: 'A valid name, email and role are required.' });
  const duplicate = await pool.query('SELECT id FROM users WHERE institute_id = $1 AND LOWER(email) = LOWER($2) AND id <> $3 LIMIT 1', [INSTITUTE_ID, email, body.id || '']);
  if (duplicate.rows.length) return res.status(409).json({ error: 'That email address is already in use.' });
  if (body.id && !await findUserById(pool, INSTITUTE_ID, body.id)) return res.status(404).json({ error: 'The user no longer exists.' });
  const password = body.password ? String(body.password) : '';
  if (password) {
    const policyError = validatePasswordPolicy(password);
    if (policyError) return res.status(400).json({ error: policyError });
  } else if (!body.id) {
    return res.status(400).json({ error: 'A password is required for a new user.' });
  }
  await upsertUser(pool, INSTITUTE_ID, {
    id: body.id, name, email, phone: String(body.phone || ''), role,
    active: body.active !== false,
  }, password ? await hashServerPassword(password) : null);
  const state = await readStateFor(req);
  res.json({ state, message: 'User saved.' });
}));

app.delete('/api/users/:id', authenticate, requireAdmin, asyncRoute(async (req, res) => {
  if (req.params.id === req.authUser.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  await deleteDbUser(pool, INSTITUTE_ID, req.params.id);
  const state = await readStateFor(req);
  res.json({ state, message: 'User deleted.' });
}));

app.post('/api/reports/:reportType/snapshots', authenticate, asyncRoute(async (req, res) => {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO report_snapshots (id, institute_id, generated_by, report_type, filters, data)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
    [id, INSTITUTE_ID, req.authUser.id, String(req.params.reportType).slice(0, 60), JSON.stringify(req.body?.filters || {}), JSON.stringify(req.body?.data || {})],
  );
  res.status(201).json({ id, message: 'Report snapshot saved.' });
}));

app.get('/api/reports/snapshots', authenticate, asyncRoute(async (req, res) => {
  const result = await pool.query('SELECT id, report_type, filters, data, created_at FROM report_snapshots WHERE institute_id = $1 ORDER BY created_at DESC LIMIT 100', [INSTITUTE_ID]);
  res.json({ snapshots: result.rows });
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (error.code === '23505') return res.status(409).json({ error: 'This record conflicts with an existing entry.' });
  if (error.code === '23503') return res.status(409).json({ error: 'This record is linked to another record that no longer exists.' });
  if (error.code === '23514') return res.status(400).json({ error: 'One of the values is not allowed by the database schema.' });
  if (status >= 500) console.error('[EduTrack API]', error);
  return res.status(status).json({ error: status >= 500 ? 'The server could not complete the request.' : error.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EduTrack API listening on http://0.0.0.0:${PORT}`);
  console.log(databaseConfigured ? `Database mode available for institute ${INSTITUTE_ID}` : 'DATABASE_URL not set — frontend will use local browser demo mode.');
});

export default app;

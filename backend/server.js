const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const port = Number(process.env.PORT) || 3000;
const databasePath = path.resolve(process.env.DB_PATH || 'evolva.sqlite');
const database = new DatabaseSync(databasePath);
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionSecret = process.env.SESSION_SECRET || '';
const sessionDurationMs = 8 * 60 * 60 * 1000;

database.exec('PRAGMA journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS contact_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    business TEXT,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS revoked_sessions (
    id TEXT PRIMARY KEY,
    revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const insertContact = database.prepare(
  'INSERT INTO contact_requests (name, email, business, service, message, consent) VALUES (?, ?, ?, ?, ?, 1)'
);
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

function sign(payload) {
  return crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({
    id: crypto.randomBytes(16).toString('hex'),
    expires: Date.now() + sessionDurationMs
  })).toString('base64url');
  return payload + '.' + sign(payload);
}

function getSession(request) {
  if (!sessionSecret) return null;
  const token = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.id || session.expires <= Date.now()) return null;
    if (database.prepare('SELECT 1 FROM revoked_sessions WHERE id = ?').get(session.id)) return null;
    return session;
  } catch {
    return null;
  }
}

function requireAdmin(request, response, next) {
  const session = getSession(request);
  if (!session) return response.status(401).json({ error: 'Inicia sesión para continuar.' });
  request.adminSession = session;
  next();
}

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '15kb' }));

app.use((request, response, next) => {
  const allowedOrigin = process.env.FRONTEND_ORIGIN;
  if (allowedOrigin && request.headers.origin === allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.setHeader('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});

app.post('/api/contact', contactLimiter, (request, response) => {
  const body = request.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const business = String(body.business || '').trim();
  const service = String(body.service || '').trim();
  const message = String(body.message || '').trim();
  const consent = body.consent === true || body.consent === 'on';

  if (!name || name.length > 100) return response.status(400).json({ error: 'Revisa el nombre.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return response.status(400).json({ error: 'Revisa el correo electrónico.' });
  }
  if (business.length > 120) return response.status(400).json({ error: 'El nombre del negocio es demasiado largo.' });
  if (!service || service.length > 160) return response.status(400).json({ error: 'Selecciona un servicio.' });
  if (message.length < 10 || message.length > 2000) {
    return response.status(400).json({ error: 'El mensaje debe tener entre 10 y 2000 caracteres.' });
  }
  if (!consent) return response.status(400).json({ error: 'Necesitamos tu consentimiento para responder a la consulta.' });

  try {
    const result = insertContact.run(name, email, business, service, message);
    return response.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error('No se pudo guardar la consulta:', error.message);
    return response.status(500).json({ error: 'No se pudo guardar la consulta.' });
  }
});

app.post('/api/admin/login', loginLimiter, (request, response) => {
  if (adminPassword.length < 12 || sessionSecret.length < 32) {
    return response.status(503).json({ error: 'El acceso administrador todavía no está configurado.' });
  }

  const submittedPassword = Buffer.from(String(request.body?.password || ''));
  const configuredPassword = Buffer.from(adminPassword);
  const valid = submittedPassword.length === configuredPassword.length
    && crypto.timingSafeEqual(submittedPassword, configuredPassword);

  if (!valid) return response.status(401).json({ error: 'La contraseña no es correcta.' });
  return response.json({ ok: true, token: createSession() });
});

app.get('/api/admin/session', (request, response) => {
  response.json({ authenticated: Boolean(getSession(request)) });
});

app.post('/api/admin/logout', (request, response) => {
  const session = getSession(request);
  if (session) database.prepare('INSERT OR IGNORE INTO revoked_sessions (id) VALUES (?)').run(session.id);
  return response.json({ ok: true });
});

app.get('/api/admin/contacts', requireAdmin, (_request, response) => {
  const contacts = database.prepare(
    'SELECT id, name, email, business, service, message, created_at FROM contact_requests ORDER BY created_at DESC, id DESC LIMIT 200'
  ).all();
  return response.json({ contacts });
});

app.delete('/api/admin/contacts/:id', requireAdmin, (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return response.status(400).json({ error: 'La solicitud indicada no es válida.' });
  }

  const result = database.prepare('DELETE FROM contact_requests WHERE id = ?').run(id);
  if (!result.changes) return response.status(404).json({ error: 'La solicitud ya no existe.' });
  return response.json({ ok: true });
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`EVOLVA API escuchando en el puerto ${port}`);
});

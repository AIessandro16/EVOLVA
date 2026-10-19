const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT) || 3000;
const databasePath = path.resolve(process.env.DB_PATH || 'evolva.sqlite');
const database = new DatabaseSync(databasePath);

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

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`EVOLVA API escuchando en el puerto ${port}`);
});

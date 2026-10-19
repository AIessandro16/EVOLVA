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
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has enviado varias preguntas seguidas. Espera un minuto y vuelve a intentarlo.' }
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

function normalizeAssistantHistory(history) {
  if (!Array.isArray(history)) return [];

  return history.slice(-8).map((item) => {
    if (item?.role === 'user' && typeof item.text === 'string') {
      return { role: 'user', parts: [{ text: item.text.slice(0, 1000) }] };
    }

    if (item?.role !== 'assistant') return null;
    if (typeof item.text === 'string') {
      return { role: 'model', parts: [{ text: item.text.slice(0, 1000) }] };
    }
    if (!Array.isArray(item.parts)) return null;

    const parts = item.parts.slice(0, 4).map((part) => {
      const safePart = {};
      if (typeof part?.text === 'string') safePart.text = part.text.slice(0, 1200);
      if (typeof part?.thoughtSignature === 'string') safePart.thoughtSignature = part.thoughtSignature;
      if (typeof part?.thought === 'boolean') safePart.thought = part.thought;
      return safePart;
    }).filter((part) => Object.keys(part).length > 0);

    return parts.length ? { role: 'model', parts } : null;
  }).filter(Boolean);
}

function getGeminiErrorMessage(status) {
  const messages = {
    400: 'Gemini rechazó la solicitud. Revisa la configuración del modelo y el formato de la petición.',
    401: 'Gemini rechazó el acceso. Revisa que la clave esté activa y tenga permisos para usar la API.',
    403: 'Gemini rechazó el acceso. Revisa que la clave esté activa y tenga permisos para usar la API.',
    404: 'No se encontró el modelo de IA configurado. Revisa GEMINI_MODEL.',
    429: 'Gemini alcanzó su límite de uso o cuota. Espera un momento o revisa la cuota de la clave.'
  };
  return messages[status] || 'Gemini no pudo completar la respuesta. Inténtalo nuevamente en un momento.';
}

const assistantInstructions = `Eres Evol, el asistente de EVOLVA, un pequeño negocio de Ecuador que ayuda a otros negocios con su imagen, sus redes sociales y sus páginas web. Hablas siempre en español, de forma amable y sencilla, como si explicaras las cosas a alguien que no trabaja en marketing.

PÚBLICO Y NECESIDAD PRINCIPAL
EVOLVA está pensado especialmente para pequeños emprendimientos que están empezando o todavía no tienen movimiento en redes: por ejemplo, una hamburguesería, una tienda pequeña o alguien que revende ropa. No supongas que la persona ya tiene seguidores, publicaciones, una marca definida o página web. Puede ayudarle a comenzar desde cero y también a mejorar una presencia que ya existe.

AYUDA A LA PERSONA
Primero entiende qué negocio tiene, cómo vende hoy, qué quiere lograr y qué recursos tiene. Si falta un dato importante, haz una sola pregunta breve. Recomienda un primer paso realista y solo los servicios relacionados con su situación; explica cómo se conecta el servicio con la necesidad. No presiones a contratar si todavía necesita aclarar su idea. Explica los términos técnicos con palabras comunes. Por ejemplo, una página web sencilla es un lugar en internet donde el negocio presenta lo que ofrece y cómo contactarlo. Un calendario de publicaciones es una lista de qué publicar y cuándo.

SERVICIOS Y PRECIOS ACTUALES EN DÓLARES
Servicios puntuales: revisión del negocio en internet $25; diseño de logotipo $60; imagen de marca $125; diseños y textos para redes $45; página web para el negocio $200; plan de ideas para el negocio $70.

Community manager (manejo de redes): Inicio $99 al mes (8 publicaciones con textos, calendario sencillo, publicación en 1 red, respuestas a comentarios y mensajes hasta 15 minutos al día, 3 días por semana); Crecimiento $179 al mes (12 publicaciones, hasta 2 videos cortos editados con videos que entrega el cliente, 8 historias, publicación en hasta 2 redes y respuestas hasta 30 minutos al día, 3 días por semana); Presencia Plus $249 al mes (16 publicaciones, hasta 4 videos cortos editados con videos del cliente, 12 historias, hasta 2 redes y respuestas hasta 30 minutos diarios de lunes a viernes). No incluyen anuncios; ninguno ofrece atención permanente. Los planes se pagan al inicio del mes.

Paquetes: Imagen lista para publicar $175; Tu negocio en internet $205; Redes en marcha $195 el primer mes (plan Crecimiento más revisión inicial). Estos son precios iniciales y el valor final se confirma antes de comenzar. La dirección y el alojamiento de una página, los anuncios, las fotos y las impresiones se pagan aparte y se acuerdan previamente. No inventes descuentos, tiempos, servicios ni entregables. No prometas ventas, seguidores ni resultados específicos.

FORMA DE RESPONDER
Usa de 2 a 5 frases, con un máximo de 120 palabras. Ve al punto y evita jerga. Si preguntan por precios, menciona los actuales tal como aparecen arriba. Si preguntan por el community manager, aclara que organiza y publica contenido y responde a la comunidad dentro del tiempo del plan; no contesta 24/7 ni cierra ventas por el negocio. Si quieren contratar, invítales a completar el formulario de contacto. No pidas contraseñas, claves, datos bancarios ni información sensible.`;

app.post('/api/assistant', aiLimiter, async (request, response) => {
  const message = String(request.body?.message || '').trim();
  if (message.length < 2 || message.length > 500) {
    return response.status(400).json({ error: 'Escribe un mensaje de 2 a 500 caracteres.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return response.status(503).json({ error: 'El asistente estará disponible cuando se configure la clave de IA.' });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const contents = [
    ...normalizeAssistantHistory(request.body?.history),
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: assistantInstructions }] },
          contents,
          generationConfig: {
            maxOutputTokens: 1200,
            thinkingConfig: { thinkingLevel: 'low' }
          }
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    if (!upstream.ok) {
      const providerError = await upstream.json().catch(() => ({}));
      const providerCode = providerError.error?.status;
      console.error(`Gemini rechazó la solicitud: HTTP ${upstream.status}${providerCode ? ` (${providerCode})` : ''}`);
      return response.status(502).json({
        error: getGeminiErrorMessage(upstream.status),
        providerStatus: upstream.status
      });
    }

    const data = await upstream.json();
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') {
      return response.status(502).json({
        error: 'La respuesta quedó incompleta. Prueba con una pregunta más corta y te responderé de nuevo.'
      });
    }
    if (['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(candidate?.finishReason)) {
      return response.status(502).json({
        error: 'No pude responder esa pregunta tal como está escrita. Intenta formularla de otra manera.'
      });
    }

    const parts = candidate?.content?.parts || [];
    const answer = parts.filter((part) => !part.thought).map((part) => part.text || '').join('').trim();
    if (!answer) throw new Error('Respuesta vacía de IA');

    return response.json({
      answer,
      modelTurn: { parts: parts.length ? parts : [{ text: answer }] }
    });
  } catch (error) {
    console.error('No se pudo generar respuesta de IA:', error.message);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return response.status(504).json({
        error: 'La respuesta está tardando más de lo normal. Inténtalo otra vez en un momento.'
      });
    }
    if (error instanceof TypeError) {
      return response.status(502).json({
        error: 'No pude conectar con el servicio de IA. Revisa tu conexión e inténtalo de nuevo.'
      });
    }
    return response.status(502).json({ error: 'El asistente no pudo responder ahora. Inténtalo de nuevo en un momento.' });
  }
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`EVOLVA API escuchando en el puerto ${port}`);
});

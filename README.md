# EVOLVA

EVOLVA acompaña a emprendimientos pequeños que quieren empezar a mostrarse y crecer, incluso si todavía no tienen redes activas, una marca definida o una página web. El sitio reúne servicios y precios, un diagnóstico inicial, un formulario de contacto, un panel privado y el asistente Evol.

## Estructura

- `frontend/`: sitio público, catálogo, diagnóstico, formulario, panel y chat.
- `backend/`: API, autenticación administrativa, persistencia SQLite e integración con Gemini.
- `package.json`: dependencias y comando de inicio.

## Ejecutar en local

Requiere Node.js 22.5 o superior. Desde la carpeta del proyecto, en PowerShell:

```powershell
Copy-Item .env.example .env
npm install
```

Abre `.env` y configura una contraseña administrativa única (mínimo 12 caracteres) y una clave aleatoria larga para `SESSION_SECRET`. Para habilitar Evol, coloca la clave de Gemini en `GEMINI_API_KEY`; la clave se queda en el servidor y no debe añadirse al frontend. Luego ejecuta:

```powershell
npm start
```

Abre [http://localhost:3000](http://localhost:3000). El panel está en [http://localhost:3000/admin.html](http://localhost:3000/admin.html).

## Publicación

### Frontend en GitHub Pages

El flujo `.github/workflows/pages.yml` publica el contenido de `frontend/` al actualizar `main`. En el repositorio, abre **Settings → Pages** y selecciona **GitHub Actions** como fuente. Antes de publicar, cambia `window.EVOLVA_API_BASE` en `frontend/config.js` por la URL HTTPS pública del backend, sin una barra final.

### API en Render

Crea un servicio web para este repositorio con:

- Build command: `npm install`
- Start command: `npm start`
- Variables: `ADMIN_PASSWORD`, `SESSION_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `FRONTEND_ORIGIN` y `DB_PATH`.

`FRONTEND_ORIGIN` debe ser el origen exacto de Pages (por ejemplo, `https://aiessandro16.github.io`), sin la ruta del repositorio. Configura un disco persistente y apunta `DB_PATH` a una ruta dentro de ese disco para conservar las solicitudes entre reinicios. No subas `.env`, claves, contraseñas ni archivos SQLite al repositorio.

El API comprueba su disponibilidad en `/api/health`. Si Pages y Render usan dominios diferentes, ambas direcciones deben estar configuradas: la URL de Render en `frontend/config.js` y el origen de Pages en `FRONTEND_ORIGIN`.

## Operación

Las consultas se guardan en SQLite y se revisan desde el panel de administración. El panel permite eliminar solicitudes. Evol brinda orientación inicial y depende de la cuota y disponibilidad configuradas para Gemini; no promete ventas ni reemplaza una consultoría completa.

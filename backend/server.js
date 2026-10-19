const express = require('express');
const helmet = require('helmet');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '15kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`EVOLVA API escuchando en el puerto ${port}`);
});

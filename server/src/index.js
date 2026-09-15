import express from 'express';
import cors from 'cors';
import { calendarioRouter } from './routes/calendario.js';
import { asistenciaRouter } from './routes/asistencia.js';

const app = express();
const PORT = process.env.PORT || 3000;

// En producción, restringe esto al dominio real del frontend en Cloudflare
// vía la variable de entorno FRONTEND_ORIGIN (coma-separado si son varios).
const origenesPermitidos = (process.env.FRONTEND_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: origenesPermitidos.includes('*') ? true : origenesPermitidos
}));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'sigee-backend', ts: new Date().toISOString() }));

app.use('/calendario', calendarioRouter);
app.use('/asistencia', asistenciaRouter);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada: ' + req.method + ' ' + req.path }));

// Manejador de errores central: nunca filtrar stack traces al cliente.
app.use((err, _req, res, _next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => console.log(`sigee-backend escuchando en :${PORT}`));

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { calendarioRouter } from './routes/calendario.js';
import { asistenciaRouter } from './routes/asistencia.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Railway pone este servicio detrás de un proxy interno; sin esto,
// express-rate-limit vería siempre la misma IP (la del proxy) y limitaría
// a TODOS los usuarios juntos como si fueran uno solo.
app.set('trust proxy', 1);

// En producción, restringe esto al dominio real del frontend en Cloudflare
// vía la variable de entorno FRONTEND_ORIGIN (coma-separado si son varios).
const origenesPermitidos = (process.env.FRONTEND_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: origenesPermitidos.includes('*') ? true : origenesPermitidos
}));
app.use(express.json());

// Colchón contra picos (ej. muchos cursos guardando asistencia a la misma
// hora de entrada): por IP, no por institución — un plantel con muchos
// docentes detrás del mismo NAT podría necesitar subir este número más
// adelante si se ve que choca en la práctica.
app.use(['/asistencia', '/calendario'], rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones seguidas. Espera un momento y reintenta.' }
}));

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

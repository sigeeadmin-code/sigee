import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { calendarioRouter } from './routes/calendario.js';
import { asistenciaRouter } from './routes/asistencia.js';
import { calificacionesRouter } from './routes/calificaciones.js';
import { correosRouter } from './routes/correos.js';
import { requireAuth, requireRole } from './lib/auth.js';
import { crearContador, registrarPeticion, serieHoraria, leerRecursos } from './lib/metricas.js';
import { crearVigilante } from './lib/seguridad.js';
import { supabase as supabaseAdmin } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Railway pone este servicio detrás de un proxy interno; sin esto,
// express-rate-limit vería siempre la misma IP (la del proxy) y limitaría
// a TODOS los usuarios juntos como si fueran uno solo.
app.set('trust proxy', 1);

// Soporte TIC: IP bloqueadas por el Super Admin y registro de peticiones rechazadas / rutas inexistentes (sondeos).
const vigilante = crearVigilante({ supabase: supabaseAdmin });
app.use(vigilante.bloqueo);
app.use(vigilante.vigilancia);

// En producción, restringe esto al dominio real del frontend en Cloudflare
// vía la variable de entorno FRONTEND_ORIGIN (coma-separado si son varios).
const origenesPermitidos = (process.env.FRONTEND_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: origenesPermitidos.includes('*') ? true : origenesPermitidos
}));
app.use(express.json());

// Colchón contra picos (ej. muchos cursos guardando asistencia a la misma
// hora de entrada): por IP, no por institución. Un colegio entero sale a
// internet por la MISMA IP (NAT), así que el tope se comparte entre todos sus
// docentes: cada guardado es 1 sola petición (upsert por lote), por lo que
// 200/min (~3 por segundo) cubre con holgura la hora pico de un colegio
// grande y aún frena abusos o bucles descontrolados.
app.use(['/asistencia', '/calendario', '/calificaciones'], rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones seguidas. Espera un momento y reintenta.' }
}));

// Correos: tope aparte y más bajo (cada petición envía un correo real).
app.use('/correos', rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados envíos seguidos. Espera un momento.' } }));

// Cuenta el tráfico por hora (sin contar /health ni /metricas) para el gráfico de horas pico del Diagnóstico.
const contador = crearContador();
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/metricas') return next();
  const t0 = Date.now();
  res.on('finish', () => registrarPeticion(contador, t0, Date.now() - t0, res.statusCode));
  next();
});

app.get('/metricas', requireAuth, requireRole('super_admin'), (_req, res) => res.json({ ...leerRecursos(), serie: serieHoraria(contador), contando_desde: new Date(contador.desde).toISOString() }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'sigee-backend', ts: new Date().toISOString() }));

app.use('/calendario', calendarioRouter);
app.use('/asistencia', asistenciaRouter);
app.use('/calificaciones', calificacionesRouter);
app.use('/correos', correosRouter);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada: ' + req.method + ' ' + req.path }));

// Manejador de errores central: nunca filtrar stack traces al cliente.
app.use((err, _req, res, _next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => console.log(`sigee-backend escuchando en :${PORT}`));

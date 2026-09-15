# sigee-backend

API centralizada de reglas de negocio para SIGEE. No reemplaza a Supabase (la base
sigue siendo Supabase), sino que se pone delante de las escrituras críticas
(asistencia, calendario) para que la validación no dependa de qué frontend la llame
(React, el HTML legado, o uno futuro) — todos hablan con esta misma API.

## Por qué existe
El frontend habla directo a Supabase con la `anon key`. Eso es válido siempre que las
políticas RLS cubran todo, pero reglas de negocio complejas (¿es día lectivo?, ¿esta
carga es de este docente?) son más fáciles de mantener consistentes en un solo backend
que replicadas en cada cliente.

## Variables de entorno
Copia `.env.example` a `.env` y completa `SUPABASE_SERVICE_ROLE_KEY` (Settings → API
en el dashboard de Supabase — la key `service_role`, **no** la `anon`).

## Desarrollo local
```
npm install
npm run dev
```

## Endpoints
- `GET /health`
- `GET /calendario/dia?fecha=YYYY-MM-DD&paralelo_id=uuid` — evalúa si la fecha es lectiva
- `POST /calendario/eventos` — crear feriado/vacación/excepción/recuperación/evento
- `DELETE /calendario/eventos/:id`
- `POST /asistencia` — guarda asistencia; rechaza si el día no es lectivo
- `GET /asistencia?docente_materia_id=&fecha=`

Todas las rutas (salvo `/health`) requieren `Authorization: Bearer <access_token>` con
el mismo token de sesión que ya emite Supabase Auth en el frontend.

## Despliegue en Railway
1. Conecta este repo/carpeta como servicio en Railway (root directory: `server` si vive
   dentro del monorepo de `sigee`).
2. Configura las variables de entorno de arriba en el servicio.
3. Railway detecta `railway.json` y usa `npm start` con healthcheck en `/health`.

# Handoff para Claude — Módulo Oficios SIGEE

## Contexto

- **Repo:** `sigeeadmin-code/sigee`
- **Producción:** React + Vite + Supabase (no Next.js).
- **Este prototipo:** `ui-oficios/` (Next 15) = referencia UX/UI pro max.
- **SQL/RPC:** `supabase/sql/2026-10-28_oficios_*.sql` (revisar e integrar).

## Qué hacer

1. Leer `ui-oficios/README.md` y la especificación PDF del módulo.
2. Validar/ajustar tablas RLS y RPC sin romper `es_super_admin`, `mi_institucion`, `mi_rol`.
3. Portar pantallas a Vite:
   - Bandeja emisor (`app/page.tsx` + EmisorMetrics/Table)
   - Bandeja por cargo (ya parcialmente en `ui-oficios/app/bandeja-por-cargo`)
   - Detalle documento (plantilla entrega/auditoría, recorrido inmutable, versiones, seguimientos)
4. Conectar acciones a RPC: crear borrador, enviar a ruta, aprobar paso, observar, rechazar, registrar entrega, generar seguimiento.
5. Sustituir mocks de `lib/oficios-data.ts` por queries reales.
6. No modificar módulos asistencia/calificaciones ni nav hasta estar listo.
7. UI: respetar tokens (`--primary` #1F4E79, SLA 24h/48h, font-doc mono para N° oficio).

## Archivos clave del prototipo

| Área | Path |
|------|------|
| Datos/tipos | `ui-oficios/lib/oficios-data.ts` |
| Tokens CSS | `ui-oficios/styles/tailwind.css` |
| Emisor | `ui-oficios/app/page.tsx`, `app/components/*` |
| Despacho | `ui-oficios/app/bandeja-por-cargo/*` |
| Detalle | `ui-oficios/app/detalle-del-documento/*` |
| Shell | `ui-oficios/components/{AppLayout,Sidebar,Topbar}.tsx` |
| UI kit | `ui-oficios/components/ui/*` |

## Criterios de aceptación

- Un PDF por versión de contenido; historial append-only.
- Dual print: entrega limpia vs recorrido interno.
- SLA visible en despacho; bulk approve con confirmación.
- Versión > 5 muestra alerta anti-abuso.
- RLS por institución y cargo.

## Nota

Algunos componentes muy largos (EmisorTable, oficios-data completo, Sidebar/Topbar, DetalleModals, RecorridoTimeline, PlantillaOficio) se subieron en commits sucesivos. Si falta alguno, reconstruirlo desde el diseño de las pantallas hermanas y los tipos de `oficios-data.ts`.

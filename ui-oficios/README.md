# UI Oficios — Prototipo de referencia (SigeeOficios)

> **Para Claude / integradores:** este directorio es un **prototipo Next.js 15** del módulo de tráfico documental. **NO es el código de producción de SIGEE** (SIGEE es React + Vite). Úsalo como referencia de UX/UI y flujos para adaptar a `src/` de SIGEE y a los RPC/SQL ya existentes en `supabase/sql/`.

## Objetivo

Implementar el **Módulo Oficios y Tráfico Documental** según la especificación PDF, con UI profesional, sin romper módulos existentes (asistencia, calificaciones, etc.).

### Reglas de negocio (resumen)

- Un caso = un documento = **un PDF maestro por versión** (inmutable).
- Estados: `borrador` → `en_ruta` → `observado` | `aprobado_final` → `entregado` → `archivado` | `rechazado`.
- Rutas por tipo (Tutor → Inspector → DECE / Vicerrector / Rector / Secretaría).
- Dual vista de impresión: **entrega limpia** vs **auditoría con recorrido**.
- Historial solo-append (no editable).
- Alertas anti-abuso: versión > 5; SLA 24 h / 48 h en despacho.
- Documentos hijo de seguimiento enlazados al N° origen.

## Estructura del prototipo

```
ui-oficios/
├── README.md
├── package.json
├── styles/tailwind.css          # Design tokens SIGEE Oficios
├── lib/oficios-data.ts          # Tipos + mocks (DOCUMENTOS, DESPACHO, HISTORIAL…)
├── app/
│   ├── layout.tsx
│   ├── not-found.tsx
│   ├── page.tsx                 # → redirige / bandeja emisor (en prototipo: components emisor)
│   ├── components/              # EmisorMetrics, EmisorTable, CargaEstadoChart
│   ├── bandeja-por-cargo/
│   │   ├── page.tsx
│   │   └── components/          # CargoMetrics, DespachoTable, modales, charts
│   └── detalle-del-documento/
│       ├── page.tsx
│       └── components/          # Header, Tabs, Plantilla, Recorrido, Versiones, Seguimientos, Acciones, Modals
└── components/
    ├── AppLayout.tsx, Sidebar.tsx, Topbar.tsx
    └── ui/                      # MetricCard, Modal, Badge, RouteStepper, EmptyState, Tooltip…
```

## Pantallas

| Ruta | Rol | Contenido |
|------|-----|-----------|
| `/` (Bandeja emisor) | Tutor / emisor | Métricas observados/en ruta/borradores + tabla con tabs |
| `/bandeja-por-cargo` | Inspector, DECE, Rector… | SLA, espera máxima, tabla despacho, aprobar/observar/rechazar |
| `/detalle-del-documento` | Ambos | Plantilla PDF, recorrido inmutable, versiones, seguimientos, acciones |

## Integración con SIGEE (Vite + Supabase)

1. **SQL / RPC** (ya en repo, revisar):
   - `supabase/sql/2026-10-28_oficios_documental.sql`
   - `supabase/sql/2026-10-28_oficios_rpcs.sql`
2. **Cliente:** adaptar `lib/oficios-data.ts` a llamadas reales (`oficios_bandeja`, `oficios_aprobar_paso`, etc.).
3. **UI:** portar componentes a JSX de Vite; reutilizar tokens CSS (`--primary`, `--success`, SLA semáforo).
4. **Nav:** añadir entradas en `src/lib/nav.js` solo cuando el módulo esté listo.
5. **No tocar** rutas ni RLS de otros módulos.

## Design system (tokens)

- Primary `#1F4E79`, Accent `#C97A12`, Success `#2F7D4F`, Warning `#B8700B`, Destructive `#B3392F`
- Fondo papel `#F6F5F1`, tipografía Plus Jakarta Sans + IBM Plex Mono (números de oficio)
- Animaciones: `fade-up`, `modal-in`, `slide-bar`, `pulse-dot` (SLA)

## Dependencias del prototipo

`next@15`, `react@19`, `recharts`, `lucide-react`, `react-hook-form`, `sonner`, `@heroicons/react`, Tailwind 3.4.

## Checklist para Claude

- [ ] Revisar RPC y RLS contra especificación PDF
- [ ] Mapear mock data → tablas Supabase
- [ ] Portar bandeja emisor + bandeja por cargo a Vite
- [ ] Portar detalle (plantilla + historial + versiones)
- [ ] Conectar acciones (aprobar / observar / rechazar / entrega / seguimiento)
- [ ] Pruebas de no-regresión en asistencia y calificaciones
- [ ] Publicar edge/SQL solo tras revisión

**Importante:** este folder es **referencia**. El despliegue productivo va en el árbol Vite de SIGEE + Supabase, no como app Next paralela en producción salvo decisión explícita.

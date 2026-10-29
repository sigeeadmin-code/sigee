# UI · Bandeja por cargo (Oficios)

Prototipo / referencia de UI **pro** para el módulo Oficios y Tráfico Documental.

## Importante para Claude

- El repositorio principal de SIGEE es **Vite + React** (`src/App.jsx`, `src/pages/…`), **no** Next.js App Router.
- Estos archivos viven en `ui-oficios/` como **fuente de diseño y comportamiento** para portar a SIGEE sin romper el sistema.
- Backend ya existe en el repo:
  - `supabase/sql/2026-10-28_oficios_documental.sql` (tablas + RLS)
  - `supabase/sql/2026-10-28_oficios_rpcs.sql` (RPCs: bandeja, aprobar, observar, rechazar, …)
  - `src/lib/oficiosDocumental.js` + `src/pages/OficiosDocumental.jsx` (cliente Vite actual)

## Qué hacer

1. Ejecutar los SQL de oficios en Supabase (si aún no).
2. Portar esta UI a Vite:
   - Reemplazar `next/link` por `react-router-dom` `Link`.
   - Reemplazar `sonner` por el toast SIGEE existente (o instalar sonner).
   - Conectar acciones a `oficios_aprobar_paso`, `oficios_observar`, `oficios_rechazar`, `oficios_bandeja`.
   - Sustituir mocks de `@/lib/oficios-data` por datos reales.
3. Opcional: si el proyecto migra a Next, montar `app/bandeja-por-cargo` tal cual (ajustando aliases).

## Archivos

| Ruta | Rol |
|------|-----|
| `app/bandeja-por-cargo/page.tsx` | Página principal |
| `…/CargoMetrics.tsx` | KPIs + gráficos |
| `…/DespachoTable.tsx` | Cola, filtros, SLA, bulk approve |
| `…/DespachoActionModals.tsx` | Aprobar / observar / rechazar |
| `…/EsperaCargoChart.tsx` | Barras espera por cargo |
| `…/LlegadasChart.tsx` | Área llegadas vs resueltos |
| `lib/oficios-data.ts` | Tipos + mock demo |
| `components/ui/*` | Stubs (MetricCard, Modal, Badge, …) |

Dependencias UI de referencia: `lucide-react`, `recharts`, `react-hook-form`, `sonner`, Tailwind tokens (`border-border`, `bg-card`, …).

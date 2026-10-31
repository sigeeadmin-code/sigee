# Módulo Oficios y Tráfico Documental · SIGEE

**Especificación:** v1.0 · 27 oct 2026  
**Principio:** un caso = un documento = un PDF por versión · firmas = acciones de usuario (no PDFs paralelos).

## Orden de despliegue (Claude / admin)

### 1. SQL en Supabase (SQL Editor)

Ejecutar **en este orden**, sin borrar nada existente:

1. `supabase/sql/2026-10-28_oficios_documental.sql`  
   → tablas `oficios_tipos`, `oficios_documentos`, `oficios_correlativos` + RLS + seeds de tipos

2. `supabase/sql/2026-10-28_oficios_rpcs.sql`  
   → 10 funciones security definer + grants a `authenticated`  
   → usa `es_super_admin()`, `mi_institucion()`, `mi_rol()` del sistema actual  
   → **no toca** otras tablas ni políticas existentes

### 2. Frontend (ya en el repo)

| Archivo | Rol |
|---------|-----|
| `src/lib/oficiosDocumental.js` | Cliente RPC + helpers |
| `src/pages/OficiosDocumental.jsx` | UI bandeja + detalle + impresión |
| `src/App.jsx` | Ruta `/oficios` |
| `src/lib/nav.js` | Menú para admin, secretario, inspector, docente (tutor) |

### 3. Verificar

- Login como tutor/docente → crear borrador → enviar a ruta
- Login como inspector → ver en bandeja → aprobar / observar
- Imprimir «Para entrega» (sin historial) y «Con recorrido» (con historial)
- CA-01 … CA-10 de la especificación

## Seguridad (no romper el sistema)

- Solo `create table if not exists` / `create or replace function`
- RLS por `mi_institucion()` + emisor
- RPCs `security definer` con `set search_path = public`
- Grants solo a `authenticated`; revoke a `anon`
- Mapeo rol→cargo alineado a roles reales de SIGEE (`inspector_general`, `admin_plantel`, `secretario`, `docente`, etc.)

## Tipos de documento

oficio_alerta · ficha_tutor · plan_refuerzo · acta_compromiso · oficio_faltas · informe_seguimiento

## Estados

borrador → en_ruta ⇄ observado → aprobado_final → entregado → archivado  
(también: rechazado)

## Pendiente (Fase 3–4, opcional)

- Atajos desde alertas de calificaciones y ficha de asistencia
- Pestaña Oficios en ficha del estudiante
- Storage de PDF en Supabase Storage
- Notificaciones al siguiente cargo
- Portal representante (acuse)

---
*Zona 7 · El Oro · Ecuador · Listo para que Claude lea, ejecute SQL y publique*

## v1.1 (29 oct 2026) · adaptación al sistema
- **SQL** `2026-10-29_oficios_ajustes.sql` (ya aplicado en producción): una sola regla de permisos (`oficios_puede_actuar`), un docente solo actúa en el paso «tutor» de SUS documentos, `oficios_guardar_borrador` / `oficios_eliminar_borrador` / `oficios_obtener`, `tiempo_espera` real, y la versión solo sube si el contenido cambió. La bandeja devuelve `puede_actuar`, `soy_emisor`, `espera_seg`, `emisor_nombre`.
- **Escritura solo por RPC**: la tabla no tiene políticas de insert/update/delete para el cliente.
- **UI**: `src/pages/OficiosDocumental.jsx` solo orquesta; piezas reutilizables en `src/components/oficios/` (tabla responsive, detalle, ruta, recorrido, buscador de estudiante, impresión) y lógica pura probada en `src/lib/oficiosVista.js` (`tests/oficiosVista.test.mjs`). Estilos `ofd-*` al final de `styles.css` con los tokens del sistema.
- Pendiente (fases 3-4 de la especificación): vincular con `fichas_control` / `oficios_inasistencia`, seguimientos desde el origen, notificación al siguiente cargo, rutas configurables por plantel, cargos DECE/Vicerrector asignables.

## v1.2 (30 oct 2026) · tableros, documento oficial y recorrido
- **Documento oficial dentro del trámite**: `src/lib/documentoOficio.js` reutiliza los constructores y las notas reales de las fichas (`fichasRendimiento.js`: oficio de alerta, plan de refuerzo, acta, ficha del tutor); el trámite solo agrega número, ruta, versiones y firmas. Se guarda en `datos_plantilla.documento` (bloques) y `datos_plantilla.notas` (texto plano). Oficio por inasistencia e informe de seguimiento usan una hoja general con el mismo formato.
- **Visor** (`OficioDocumentoModal`): «Vista de entrega» y «Vista con recorrido»; el emisor edita sobre la hoja (borrador u observado). **Impresión**: `OficioImpresion` se monta en `<body>` por portal (la regla `body.imprimiendo-oficio` oculta el resto) y usa los márgenes A4 del sistema (`useImpresionOficio`).
- **Tableros**: «Mis documentos» (observados, en ruta, borradores, versión > 5, tiempo medio vs meta de 3 días, carga por estado) y «Por mi cargo» (pendientes por semáforo 24/48 h, espera máxima y media, resueltos hoy, devoluciones de la semana, espera media por cargo, llegadas y resoluciones por día). Lógica pura y probada en `src/lib/oficiosVista.js`; gráficos SVG en `Graficos.jsx`.
- **Cola de despacho**: pestañas por cargo, banner de > 48 h, filtros Todos / Vencidos / Reenviados, columnas configurables (se recuerdan por navegador), ver documento, seguir recorrido, y aprobar / observar / rechazar en línea.
- **Detalle** como panel lateral fijo (pantalla completa en celular), con indicadores del trámite y documentos relacionados.
- **Familia**: `oficios_hoja_ruta_familia` ahora devuelve también el documento oficial aprobado.
- **Base de datos** (migraciones ya aplicadas en Supabase): `oficios_numero_al_crear_y_documento_familia` (el número se asigna al crear el borrador).

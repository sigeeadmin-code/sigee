# Módulo Oficios y Tráfico Documental · SIGEE

**Especificación:** v1.0 · 27 de octubre de 2026  
**Principio:** un caso = un documento = un PDF por versión de contenido · recorrido con firmas en el sistema.

## Archivos del módulo (en este repo)

| Ruta | Descripción |
|------|-------------|
| `supabase/sql/2026-10-28_oficios_documental.sql` | Tablas `oficios_tipos`, `oficios_documentos`, `oficios_correlativos` + RLS |
| `src/lib/oficiosDocumental.js` | Cliente: tipos, estados, RPCs, helpers |
| `src/pages/OficiosDocumental.jsx` | UI: bandejas, detalle, acciones, impresión entrega/recorrido |
| `src/App.jsx` | Ruta `/oficios` |
| `src/lib/nav.js` | Ítem de menú para roles relevantes |

## Qué debe hacer Claude (o el admin)

1. **Aplicar el SQL en Supabase** (SQL Editor del proyecto):
   - Ejecutar `supabase/sql/2026-10-28_oficios_documental.sql` (tablas + políticas).
   - Completar las **funciones RPC** si el archivo base no las trae todas:
     - `oficios_siguiente_numero`
     - `oficios_crear_borrador`
     - `oficios_enviar`
     - `oficios_aprobar_paso`
     - `oficios_observar`
     - `oficios_corregir`
     - `oficios_registrar_entrega`
     - `oficios_archivar`
     - `oficios_rechazar`
     - `oficios_bandeja`
   - Las firmas y lógica están en la especificación adjunta y en el historial de commits de Grok.

2. **Revisar / corregir:**
   - Mapeo rol ↔ cargo en `puedeActuarEnPaso` y en `oficios_aprobar_paso`.
   - Plantillas por tipo (datos_plantilla) más ricas (tablas de notas, cronograma).
   - Integración con alertas de calificaciones y ficha de asistencia (atajos “Generar oficio”).
   - Storage de PDF en Supabase Storage (Fase 4).

3. **Publicar:** deploy frontend (Vite/Cloudflare) tras merge.

## Criterios de aceptación (CA-01 … CA-10)

Ver especificación PDF. Resumen:
- Crear borrador de cada tipo y enviar a ruta.
- Cada autoridad solo actúa en su `paso_actual`.
- Observar exige motivo; reenviar continúa.
- No se crea un segundo documento al firmar.
- Imprimir entrega sin recorrido; imprimir con recorrido incluye historial.
- Seguimientos enlazan `documento_origen_id/numero`.
- Versión PDF solo sube tras corrección de contenido.

## Estados

`borrador` → `en_ruta` → (`observado` → corregir → `en_ruta`) → `aprobado_final` → `entregado` → `archivado`  
También: `rechazado`.

## Tipos

oficio_alerta, ficha_tutor, plan_refuerzo, acta_compromiso, oficio_faltas, informe_seguimiento.

---
*Generado por Grok para SIGEE · Zona 7 · El Oro · Ecuador*

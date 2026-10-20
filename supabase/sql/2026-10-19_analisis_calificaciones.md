# Análisis de calificaciones (alertas tempranas) — objetos en Supabase

Aplicados a mano en el proyecto `pvwsdohhydeqmruopkfc` el 19-oct-2026 (no hay carpeta de migraciones en este repo).

- Tabla `alertas_seguimiento` (RLS activa, sin políticas: solo se toca vía RPC). Estado: pendiente / en_atencion / resuelto + nota.
- `analisis_calificaciones(p_institucion, p_trimestre, p_semanas, p_meses)` — SECURITY DEFINER. Alerta = promedio 0,01–6,99.
  Promedio parcial = (formativo×0,7 + sumativo×0,3) normalizado por lo ya evaluado; grupos ponderados con `config_evaluacion` (carga → paralelo → plantel → por defecto).
  Alcance: super_admin / supervisor_general (cualquier plantel); admin_plantel, secretario, supervisor_plantel, inspector_general (su plantel); docente (solo sus cargas).
- `detalle_estudiante_calificaciones(p_estudiante, p_trimestre)` — actividades y proyecto por materia, con mismo control de acceso.
- `guardar_seguimiento_alerta(...)` — staff del plantel y el docente dueño de la carga.
- Índice `idx_matriculas_paralelo_periodo_activa`.
Las semanas/meses se calculan con `calificaciones_aportes.updated_at` (hora de Ecuador, semana desde el lunes).

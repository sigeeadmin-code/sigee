-- SIGEE · Oficios · ajustes v1.1 (29 oct 2026)
-- SOLO create or replace function (misma firma que v1.0 salvo las nuevas). No toca datos ni tablas.
-- 1) Una sola regla de "quién puede actuar" (antes estaba duplicada en SQL y en el cliente).
-- 2) Un docente solo actúa en el paso "tutor" de SUS documentos (antes: de cualquiera del plantel).
-- 3) Guardar/eliminar borrador por RPC (las políticas directas de escritura se retiraron en v1.0).
-- 4) tiempo_espera real en el historial (segundos entre una acción y la siguiente).
-- 5) La versión solo sube si el contenido realmente cambió (principio P2 de la especificación).

create or replace function public.oficios_nombre_usuario(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select nullif(btrim(coalesce(apellidos, '') || ' ' || coalesce(nombres, '')), '') from public.profiles where id = p_id;
$$;

create or replace function public.oficios_puede_actuar(d public.oficios_documentos)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_rol text; v_cargo text;
begin
  if auth.uid() is null or d.estado <> 'en_ruta' then return false; end if;
  if public.es_super_admin() then return true; end if;
  if d.institucion_id is distinct from public.mi_institucion() then return false; end if;
  v_cargo := (d.ruta -> d.paso_actual) ->> 'cargo';
  if v_cargo is null then return false; end if;
  v_rol := public.mi_rol()::text;
  return case
    when v_rol = 'docente' then v_cargo = 'tutor' and d.emisor_id = auth.uid()
    when v_rol = 'inspector_general' then v_cargo in ('inspector_general', 'tutor')
    when v_rol in ('admin_plantel', 'supervisor_plantel', 'supervisor_general') then true
    when v_rol in ('secretario', 'administrativo', 'contador_plantel') then v_cargo in ('secretaria', 'inspector_general')
    else false
  end;
end; $$;

create or replace function public.oficios_espera_seg(d public.oficios_documentos)
returns integer language sql stable set search_path = public as $$
  select case when jsonb_array_length(coalesce(d.historial_recorrido, '[]'::jsonb)) = 0 then null
    else greatest(0, round(extract(epoch from (now() - ((d.historial_recorrido -> (jsonb_array_length(d.historial_recorrido) - 1)) ->> 'fecha_accion')::timestamptz))))::integer end;
$$;

create or replace function public.oficios_aprobar_paso(p_id uuid, p_comentario text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_cargo text; v_hist jsonb; v_ruta jsonb;
  v_nuevo_paso integer; v_nuevo_estado text; v_espera integer; v_entrada text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado <> 'en_ruta' then raise exception 'El documento no está en ruta'; end if;
  v_ruta := coalesce(v_row.ruta, '[]'::jsonb);
  if v_row.paso_actual < 0 or v_row.paso_actual >= jsonb_array_length(v_ruta) then raise exception 'Paso actual inválido'; end if;
  v_cargo := (v_ruta -> v_row.paso_actual) ->> 'cargo';
  if not public.oficios_puede_actuar(v_row) then
    raise exception 'No tienes permiso para actuar en el paso «%»', v_cargo using errcode = '42501';
  end if;
  v_espera := public.oficios_espera_seg(v_row);
  v_entrada := (v_row.historial_recorrido -> (jsonb_array_length(v_row.historial_recorrido) - 1)) ->> 'fecha_accion';
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_cargo, 'usuario_id', auth.uid(), 'usuario_nombre', public.oficios_nombre_usuario(auth.uid()),
    'accion', 'aprobado', 'fecha_entrada', coalesce(v_entrada, now()::text), 'fecha_accion', now(), 'tiempo_espera', v_espera,
    'comentario', coalesce(nullif(btrim(p_comentario), ''), 'Aprobado'), 'version_pdf', v_row.version
  );
  v_ruta := jsonb_set(v_ruta, array[v_row.paso_actual::text, 'estado_paso'], '"aprobado"'::jsonb);
  v_ruta := jsonb_set(v_ruta, array[v_row.paso_actual::text, 'usuario_id'], to_jsonb(auth.uid()::text));
  v_nuevo_paso := v_row.paso_actual + 1;
  if v_nuevo_paso >= jsonb_array_length(v_ruta) then v_nuevo_estado := 'aprobado_final'; v_nuevo_paso := v_row.paso_actual;
  else v_nuevo_estado := 'en_ruta'; end if;
  update public.oficios_documentos set estado = v_nuevo_estado, ruta = v_ruta, paso_actual = v_nuevo_paso,
    historial_recorrido = v_hist, updated_at = now(),
    closed_at = case when v_nuevo_estado = 'aprobado_final' then now() else closed_at end
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_observar(p_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_cargo text; v_hist jsonb; v_ruta jsonb; v_entrada text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if nullif(btrim(p_motivo), '') is null then raise exception 'El motivo de observación es obligatorio'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado <> 'en_ruta' then raise exception 'Solo se puede observar un documento en ruta'; end if;
  if not public.oficios_puede_actuar(v_row) then
    raise exception 'No tienes permiso para observar en este paso' using errcode = '42501';
  end if;
  v_ruta := coalesce(v_row.ruta, '[]'::jsonb);
  v_cargo := coalesce((v_ruta -> v_row.paso_actual) ->> 'cargo', 'revisor');
  v_entrada := (v_row.historial_recorrido -> (jsonb_array_length(v_row.historial_recorrido) - 1)) ->> 'fecha_accion';
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_cargo, 'usuario_id', auth.uid(), 'usuario_nombre', public.oficios_nombre_usuario(auth.uid()),
    'accion', 'observado', 'fecha_entrada', coalesce(v_entrada, now()::text), 'fecha_accion', now(),
    'tiempo_espera', public.oficios_espera_seg(v_row), 'comentario', btrim(p_motivo), 'version_pdf', v_row.version
  );
  v_ruta := jsonb_set(v_ruta, array[v_row.paso_actual::text, 'estado_paso'], '"observado"'::jsonb);
  update public.oficios_documentos set estado = 'observado', ruta = v_ruta,
    historial_recorrido = v_hist, updated_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

-- La versión sube solo si cambió el contenido; si no cambió, devuelve el documento tal cual.
create or replace function public.oficios_corregir(
  p_id uuid, p_datos_plantilla jsonb default null, p_titulo text default null, p_asunto text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_hist jsonb; v_nueva_ver integer;
  v_datos jsonb; v_titulo text; v_asunto text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.emisor_id <> auth.uid() and not public.es_super_admin() then
    raise exception 'Solo el emisor puede corregir' using errcode = '42501';
  end if;
  if v_row.estado <> 'observado' then raise exception 'Solo se corrige un documento observado'; end if;
  v_datos := coalesce(p_datos_plantilla, v_row.datos_plantilla);
  v_titulo := coalesce(nullif(btrim(p_titulo), ''), v_row.titulo);
  v_asunto := coalesce(p_asunto, v_row.asunto);
  if v_datos is not distinct from v_row.datos_plantilla and v_titulo = v_row.titulo and v_asunto is not distinct from v_row.asunto then
    return to_jsonb(v_row);
  end if;
  v_nueva_ver := v_row.version + 1;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_row.emisor_cargo, 'usuario_id', auth.uid(), 'usuario_nombre', public.oficios_nombre_usuario(auth.uid()),
    'accion', 'corregido', 'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', public.oficios_espera_seg(v_row),
    'comentario', 'Contenido corregido → versión ' || v_nueva_ver
      || case when v_nueva_ver > 5 then ' (alerta: más de 5 versiones)' else '' end,
    'version_pdf', v_nueva_ver
  );
  update public.oficios_documentos set version = v_nueva_ver, datos_plantilla = v_datos,
    titulo = v_titulo, asunto = v_asunto, historial_recorrido = v_hist, updated_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_guardar_borrador(
  p_id uuid, p_titulo text default null, p_asunto text default null, p_datos_plantilla jsonb default null,
  p_estudiante_id uuid default null, p_curso text default null, p_paralelo text default null, p_periodo text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.oficios_documentos%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.emisor_id <> auth.uid() and not public.es_super_admin() then
    raise exception 'Solo el emisor puede editar el borrador' using errcode = '42501';
  end if;
  if v_row.estado <> 'borrador' then raise exception 'Solo se edita un documento en borrador'; end if;
  update public.oficios_documentos set
    titulo = coalesce(nullif(btrim(p_titulo), ''), titulo), asunto = coalesce(p_asunto, asunto),
    datos_plantilla = coalesce(p_datos_plantilla, datos_plantilla), estudiante_id = coalesce(p_estudiante_id, estudiante_id),
    curso = coalesce(p_curso, curso), paralelo = coalesce(p_paralelo, paralelo), periodo = coalesce(p_periodo, periodo),
    updated_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_eliminar_borrador(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_row public.oficios_documentos%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or (v_row.institucion_id = public.mi_institucion() and v_row.emisor_id = auth.uid())) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado <> 'borrador' then raise exception 'Solo se elimina un borrador'; end if;
  delete from public.oficios_documentos where id = p_id;
  return true;
end; $$;

-- Bandeja: cada fila trae puede_actuar y soy_emisor calculados en el servidor.
-- Filtros: todos | mios | por_cargo | <estado>
create or replace function public.oficios_bandeja(p_filtro text default 'todos')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_inst uuid := public.mi_institucion(); v_rol text := public.mi_rol()::text; r jsonb;
  v_filtro text := coalesce(nullif(btrim(p_filtro), ''), 'todos'); v_super boolean := public.es_super_admin();
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not v_super and v_inst is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(d) || jsonb_build_object(
           'puede_actuar', public.oficios_puede_actuar(d), 'soy_emisor', d.emisor_id = auth.uid(),
           'espera_seg', public.oficios_espera_seg(d),
           'emisor_nombre', public.oficios_nombre_usuario(d.emisor_id)
         ) order by d.updated_at desc), '[]'::jsonb) into r
  from (
    select * from public.oficios_documentos d
     where (v_super or d.institucion_id = v_inst)
       and (v_super or d.emisor_id = auth.uid() or v_rol in (
         'admin_plantel', 'secretario', 'inspector_general', 'supervisor_plantel', 'supervisor_general', 'administrativo', 'contador_plantel'))
       and (case v_filtro
              when 'todos' then true
              when 'mios' then d.emisor_id = auth.uid()
              when 'por_cargo' then d.estado = 'en_ruta' and public.oficios_puede_actuar(d)
              else d.estado = v_filtro end)
     order by d.updated_at desc limit 300
  ) d;
  return r;
end; $$;

create or replace function public.oficios_obtener(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d public.oficios_documentos%rowtype;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into d from public.oficios_documentos where id = p_id;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or d.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return to_jsonb(d) || jsonb_build_object('puede_actuar', public.oficios_puede_actuar(d), 'soy_emisor', d.emisor_id = auth.uid(),
    'espera_seg', public.oficios_espera_seg(d), 'emisor_nombre', public.oficios_nombre_usuario(d.emisor_id));
end; $$;

grant execute on function public.oficios_nombre_usuario(uuid) to authenticated;
revoke execute on function public.oficios_nombre_usuario(uuid) from public, anon;
grant execute on function public.oficios_puede_actuar(public.oficios_documentos) to authenticated;
grant execute on function public.oficios_espera_seg(public.oficios_documentos) to authenticated;
grant execute on function public.oficios_guardar_borrador(uuid, text, text, jsonb, uuid, text, text, text) to authenticated;
grant execute on function public.oficios_eliminar_borrador(uuid) to authenticated;
grant execute on function public.oficios_obtener(uuid) to authenticated;
revoke execute on function public.oficios_puede_actuar(public.oficios_documentos) from public, anon;
revoke execute on function public.oficios_espera_seg(public.oficios_documentos) from public, anon;
revoke execute on function public.oficios_guardar_borrador(uuid, text, text, jsonb, uuid, text, text, text) from public, anon;
revoke execute on function public.oficios_eliminar_borrador(uuid) from public, anon;
revoke execute on function public.oficios_obtener(uuid) from public, anon;
notify pgrst, 'reload schema';

-- SIGEE · Módulo Oficios · RPCs v1.0
-- Ejecutar DESPUÉS de 2026-10-28_oficios_documental.sql (tablas + RLS)
-- SOLO AGREGA funciones. Compatible con es_super_admin(), mi_institucion(), mi_rol().

create or replace function public.oficios_siguiente_numero(p_institucion uuid, p_prefijo text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_anio integer := extract(year from (now() at time zone 'America/Guayaquil'))::integer;
  v_ult integer; v_amie text; v_pref text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not (public.es_super_admin() or p_institucion = public.mi_institucion()) then
    raise exception 'No autorizado para este plantel' using errcode = '42501';
  end if;
  insert into public.oficios_correlativos (institucion_id, anio, ultimo) values (p_institucion, v_anio, 0)
  on conflict (institucion_id, anio) do nothing;
  update public.oficios_correlativos set ultimo = ultimo + 1
   where institucion_id = p_institucion and anio = v_anio returning ultimo into v_ult;
  select coalesce(nullif(btrim(amie), ''), 'UE') into v_amie from public.instituciones where id = p_institucion;
  v_pref := coalesce(nullif(btrim(p_prefijo), ''), '');
  if v_pref <> '' then return lpad(v_ult::text, 4, '0') || '-' || v_anio || '-' || v_amie || '-' || v_pref; end if;
  return lpad(v_ult::text, 4, '0') || '-' || v_anio || '-' || v_amie;
end; $$;

create or replace function public.oficios_crear_borrador(
  p_institucion uuid, p_tipo text, p_titulo text,
  p_estudiante_id uuid default null, p_curso text default null, p_paralelo text default null,
  p_periodo text default null, p_asunto text default null,
  p_datos_plantilla jsonb default '{}'::jsonb, p_documento_origen_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ruta text[]; v_ruta_json jsonb := '[]'::jsonb; v_cargo text; v_i integer := 0;
  v_origen_num text; v_es_seg boolean := false; v_amie text;
  v_row public.oficios_documentos%rowtype; v_rol text; v_emisor_cargo text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not (public.es_super_admin() or p_institucion = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  v_rol := public.mi_rol()::text;
  if not (public.es_super_admin() or v_rol in ('docente','inspector_general','admin_plantel','secretario','supervisor_plantel','supervisor_general')) then
    raise exception 'Tu rol no puede emitir oficios' using errcode = '42501';
  end if;
  if not exists (select 1 from public.oficios_tipos t where t.codigo = p_tipo and t.activo) then
    raise exception 'Tipo de documento no válido: %', p_tipo;
  end if;
  select ruta_default into v_ruta from public.oficios_tipos where codigo = p_tipo;
  foreach v_cargo in array coalesce(v_ruta, array[]::text[]) loop
    v_ruta_json := v_ruta_json || jsonb_build_object('orden', v_i, 'cargo', v_cargo, 'usuario_id', null, 'estado_paso', 'pendiente');
    v_i := v_i + 1;
  end loop;
  if p_documento_origen_id is not null then
    select numero into v_origen_num from public.oficios_documentos
     where id = p_documento_origen_id and (institucion_id = p_institucion or public.es_super_admin());
    v_es_seg := true;
  end if;
  select coalesce(nullif(btrim(amie), ''), null) into v_amie from public.instituciones where id = p_institucion;
  v_emisor_cargo := case v_rol when 'inspector_general' then 'inspector_general' when 'admin_plantel' then 'rector' when 'secretario' then 'secretaria' else 'tutor' end;
  insert into public.oficios_documentos (
    institucion_id, amie, tipo, titulo, asunto, estudiante_id, curso, paralelo, periodo,
    emisor_id, emisor_cargo, estado, ruta, paso_actual, datos_plantilla,
    documento_origen_id, documento_origen_numero, es_seguimiento, historial_recorrido
  ) values (
    p_institucion, v_amie, p_tipo, coalesce(nullif(btrim(p_titulo), ''), 'Sin título'), p_asunto,
    p_estudiante_id, p_curso, p_paralelo, p_periodo, auth.uid(), v_emisor_cargo, 'borrador', v_ruta_json, 0,
    coalesce(p_datos_plantilla, '{}'::jsonb), p_documento_origen_id, v_origen_num, v_es_seg,
    jsonb_build_array(jsonb_build_object(
      'orden', 0, 'cargo', v_emisor_cargo, 'usuario_id', auth.uid(), 'accion', 'emitido',
      'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
      'comentario', 'Borrador creado', 'version_pdf', 1
    ))
  ) returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_enviar(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_num text; v_hist jsonb; v_ruta jsonb; v_j integer;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.emisor_id <> auth.uid() and not public.es_super_admin() then
    raise exception 'Solo el emisor puede enviar el documento' using errcode = '42501';
  end if;
  if v_row.estado not in ('borrador', 'observado') then
    raise exception 'El documento no está en estado enviable (borrador/observado)';
  end if;
  if v_row.numero is null then v_num := public.oficios_siguiente_numero(v_row.institucion_id); else v_num := v_row.numero; end if;
  v_ruta := coalesce(v_row.ruta, '[]'::jsonb);
  for v_j in 0 .. greatest(jsonb_array_length(v_ruta) - 1, -1) loop
    v_ruta := jsonb_set(v_ruta, array[v_j::text, 'estado_paso'], '"pendiente"'::jsonb);
  end loop;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_row.emisor_cargo, 'usuario_id', auth.uid(),
    'accion', case when v_row.estado = 'observado' then 'reenviado' else 'enviado' end,
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
    'comentario', case when v_row.estado = 'observado' then 'Reenviado tras corrección' else 'Enviado a ruta' end,
    'version_pdf', v_row.version
  );
  update public.oficios_documentos set estado = 'en_ruta', numero = v_num, ruta = v_ruta,
    paso_actual = 0, historial_recorrido = v_hist, updated_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_aprobar_paso(p_id uuid, p_comentario text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_paso jsonb; v_cargo text; v_hist jsonb;
  v_nuevo_paso integer; v_nuevo_estado text; v_ruta jsonb; v_rol text; v_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado <> 'en_ruta' then raise exception 'El documento no está en ruta'; end if;
  v_ruta := coalesce(v_row.ruta, '[]'::jsonb);
  if v_row.paso_actual < 0 or v_row.paso_actual >= jsonb_array_length(v_ruta) then
    raise exception 'Paso actual inválido';
  end if;
  v_paso := v_ruta -> v_row.paso_actual; v_cargo := v_paso ->> 'cargo'; v_rol := public.mi_rol()::text;
  if public.es_super_admin() then v_ok := true;
  elsif v_rol = 'docente' and v_cargo = 'tutor' then v_ok := true;
  elsif v_rol = 'inspector_general' and v_cargo in ('inspector_general', 'tutor') then v_ok := true;
  elsif v_rol in ('admin_plantel', 'supervisor_plantel', 'supervisor_general') then v_ok := true;
  elsif v_rol in ('secretario', 'administrativo', 'contador_plantel') and v_cargo in ('secretaria', 'inspector_general') then v_ok := true;
  end if;
  if not v_ok then raise exception 'No tienes permiso para actuar en el paso «%»', v_cargo using errcode = '42501'; end if;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_cargo, 'usuario_id', auth.uid(), 'accion', 'aprobado',
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
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
  v_row public.oficios_documentos%rowtype; v_paso jsonb; v_cargo text; v_hist jsonb; v_ruta jsonb;
  v_rol text; v_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if nullif(btrim(p_motivo), '') is null then raise exception 'El motivo de observación es obligatorio'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado <> 'en_ruta' then raise exception 'Solo se puede observar un documento en ruta'; end if;
  v_ruta := coalesce(v_row.ruta, '[]'::jsonb); v_paso := v_ruta -> v_row.paso_actual;
  v_cargo := coalesce(v_paso ->> 'cargo', 'revisor'); v_rol := public.mi_rol()::text;
  if public.es_super_admin() then v_ok := true;
  elsif v_rol = 'docente' and v_cargo = 'tutor' then v_ok := true;
  elsif v_rol = 'inspector_general' and v_cargo in ('inspector_general', 'tutor') then v_ok := true;
  elsif v_rol in ('admin_plantel', 'supervisor_plantel', 'supervisor_general') then v_ok := true;
  elsif v_rol in ('secretario', 'administrativo') and v_cargo in ('secretaria', 'inspector_general') then v_ok := true;
  end if;
  if not v_ok then raise exception 'No tienes permiso para observar en este paso' using errcode = '42501'; end if;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_cargo, 'usuario_id', auth.uid(), 'accion', 'observado',
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
    'comentario', btrim(p_motivo), 'version_pdf', v_row.version
  );
  v_ruta := jsonb_set(v_ruta, array[v_row.paso_actual::text, 'estado_paso'], '"observado"'::jsonb);
  update public.oficios_documentos set estado = 'observado', ruta = v_ruta,
    historial_recorrido = v_hist, updated_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_corregir(
  p_id uuid, p_datos_plantilla jsonb default null, p_titulo text default null, p_asunto text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_hist jsonb; v_nueva_ver integer;
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
  v_nueva_ver := v_row.version + 1;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_row.emisor_cargo, 'usuario_id', auth.uid(), 'accion', 'corregido',
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
    'comentario', 'Contenido corregido → versión ' || v_nueva_ver
      || case when v_nueva_ver > 5 then ' (alerta: más de 5 versiones)' else '' end,
    'version_pdf', v_nueva_ver
  );
  update public.oficios_documentos set version = v_nueva_ver,
    datos_plantilla = coalesce(p_datos_plantilla, datos_plantilla),
    titulo = coalesce(nullif(btrim(p_titulo), ''), titulo), asunto = coalesce(p_asunto, asunto),
    historial_recorrido = v_hist, updated_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_registrar_entrega(
  p_id uuid, p_recibido_por text, p_cedula text default null, p_medio text default 'presencial'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.oficios_documentos%rowtype; v_hist jsonb; v_rol text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if nullif(btrim(p_recibido_por), '') is null then raise exception 'Indica quién recibió el documento'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado not in ('aprobado_final', 'en_ruta') then
    raise exception 'El documento debe estar aprobado para registrar entrega';
  end if;
  v_rol := public.mi_rol()::text;
  if not (public.es_super_admin() or v_rol in ('admin_plantel','secretario','inspector_general','supervisor_plantel','administrativo')) then
    raise exception 'No tienes permiso para registrar entrega' using errcode = '42501';
  end if;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', 'secretaria', 'usuario_id', auth.uid(), 'accion', 'entregado',
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
    'comentario', 'Entregado a ' || btrim(p_recibido_por), 'version_pdf', v_row.version
  );
  update public.oficios_documentos set estado = 'entregado',
    entrega = jsonb_build_object('fecha', now(), 'medio', coalesce(nullif(btrim(p_medio), ''), 'presencial'),
      'recibido_por', btrim(p_recibido_por), 'cedula', nullif(btrim(coalesce(p_cedula, '')), '')),
    historial_recorrido = v_hist, updated_at = now(), closed_at = coalesce(closed_at, now())
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_archivar(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.oficios_documentos%rowtype; v_hist jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado not in ('entregado', 'aprobado_final') then
    raise exception 'Solo se archivan documentos entregados o aprobados';
  end if;
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', 'secretaria', 'usuario_id', auth.uid(), 'accion', 'archivado',
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
    'comentario', 'Archivado', 'version_pdf', v_row.version
  );
  update public.oficios_documentos set estado = 'archivado', historial_recorrido = v_hist,
    updated_at = now(), closed_at = coalesce(closed_at, now())
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_rechazar(p_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.oficios_documentos%rowtype; v_hist jsonb; v_cargo text;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if nullif(btrim(p_motivo), '') is null then raise exception 'Motivo de rechazo obligatorio'; end if;
  select * into v_row from public.oficios_documentos where id = p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if not (public.es_super_admin() or v_row.institucion_id = public.mi_institucion()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_row.estado not in ('en_ruta', 'observado', 'borrador') then
    raise exception 'No se puede rechazar en este estado';
  end if;
  v_cargo := coalesce((v_row.ruta -> v_row.paso_actual) ->> 'cargo', 'revisor');
  v_hist := coalesce(v_row.historial_recorrido, '[]'::jsonb) || jsonb_build_object(
    'orden', jsonb_array_length(coalesce(v_row.historial_recorrido, '[]'::jsonb)),
    'cargo', v_cargo, 'usuario_id', auth.uid(), 'accion', 'rechazado',
    'fecha_entrada', now(), 'fecha_accion', now(), 'tiempo_espera', null,
    'comentario', btrim(p_motivo), 'version_pdf', v_row.version
  );
  update public.oficios_documentos set estado = 'rechazado', motivo_rechazo = btrim(p_motivo),
    historial_recorrido = v_hist, updated_at = now(), closed_at = now()
  where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end; $$;

create or replace function public.oficios_bandeja(p_filtro text default 'todos')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_inst uuid := public.mi_institucion(); v_rol text := public.mi_rol()::text; r jsonb;
  v_filtro text := coalesce(nullif(btrim(p_filtro), ''), 'todos');
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if public.es_super_admin() then
    select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc), '[]'::jsonb) into r from (
      select * from public.oficios_documentos d
       where (v_filtro = 'todos' or d.estado = v_filtro) order by d.updated_at desc limit 200
    ) d;
    return r;
  end if;
  if v_inst is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc), '[]'::jsonb) into r from (
    select * from public.oficios_documentos d
     where d.institucion_id = v_inst
       and (d.emisor_id = auth.uid() or v_rol in (
         'admin_plantel', 'secretario', 'inspector_general',
         'supervisor_plantel', 'supervisor_general', 'administrativo'
       ))
       and (v_filtro = 'todos' or d.estado = v_filtro)
     order by d.updated_at desc limit 200
  ) d;
  return r;
end; $$;

grant execute on function public.oficios_siguiente_numero(uuid, text) to authenticated;
grant execute on function public.oficios_crear_borrador(uuid, text, text, uuid, text, text, text, text, jsonb, uuid) to authenticated;
grant execute on function public.oficios_enviar(uuid) to authenticated;
grant execute on function public.oficios_aprobar_paso(uuid, text) to authenticated;
grant execute on function public.oficios_observar(uuid, text) to authenticated;
grant execute on function public.oficios_corregir(uuid, jsonb, text, text) to authenticated;
grant execute on function public.oficios_registrar_entrega(uuid, text, text, text) to authenticated;
grant execute on function public.oficios_archivar(uuid) to authenticated;
grant execute on function public.oficios_rechazar(uuid, text) to authenticated;
grant execute on function public.oficios_bandeja(text) to authenticated;

revoke execute on function public.oficios_siguiente_numero(uuid, text) from public, anon;
revoke execute on function public.oficios_crear_borrador(uuid, text, text, uuid, text, text, text, text, jsonb, uuid) from public, anon;
revoke execute on function public.oficios_enviar(uuid) from public, anon;
revoke execute on function public.oficios_aprobar_paso(uuid, text) from public, anon;
revoke execute on function public.oficios_observar(uuid, text) from public, anon;
revoke execute on function public.oficios_corregir(uuid, jsonb, text, text) from public, anon;
revoke execute on function public.oficios_registrar_entrega(uuid, text, text, text) from public, anon;
revoke execute on function public.oficios_archivar(uuid) from public, anon;
revoke execute on function public.oficios_rechazar(uuid, text) from public, anon;
revoke execute on function public.oficios_bandeja(text) from public, anon;

-- Fin RPCs Oficios · listo para Claude / SQL Editor de Supabase

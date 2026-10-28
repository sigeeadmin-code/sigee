-- SIGEE · Módulo de Notificaciones · base de datos (SOLO AGREGA: no borra ni cambia datos existentes)
-- 1) Columnas nuevas en notificaciones: prioridad, categoría, cursos destinatarios, fijada, vigencia (con valores por defecto).
-- 2) Tabla de lecturas (quién leyó qué y cuándo).
-- 3) Reglas: cada usuario solo ve lo dirigido a él; el personal de dirección ve todo lo del plantel; solo el autor o el administrador editan/borran.
-- 4) Validación al enviar (destinatarios válidos, cursos del plantel, límites del docente) y funciones seguras para la pantalla.

alter table public.notificaciones
  add column if not exists prioridad text not null default 'normal',
  add column if not exists categoria text not null default 'general',
  add column if not exists para_paralelos uuid[],
  add column if not exists fijada boolean not null default false,
  add column if not exists expira_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notificaciones_prioridad_chk') then
    alter table public.notificaciones add constraint notificaciones_prioridad_chk check (prioridad in ('normal', 'importante', 'urgente'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notificaciones_categoria_chk') then
    alter table public.notificaciones add constraint notificaciones_categoria_chk check (categoria in ('general', 'academico', 'convivencia', 'administrativo', 'evento', 'emergencia'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notificaciones_titulo_len_chk') then
    alter table public.notificaciones add constraint notificaciones_titulo_len_chk check (char_length(btrim(titulo)) between 3 and 140);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notificaciones_cuerpo_len_chk') then
    alter table public.notificaciones add constraint notificaciones_cuerpo_len_chk check (char_length(btrim(cuerpo)) between 3 and 4000);
  end if;
end $$;
create index if not exists notificaciones_inst_fecha_idx on public.notificaciones (institucion_id, created_at desc);

create table if not exists public.notificaciones_lecturas (
  notificacion_id uuid not null references public.notificaciones(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  leida_at timestamptz not null default now(),
  primary key (notificacion_id, profile_id)
);
create index if not exists notificaciones_lecturas_profile_idx on public.notificaciones_lecturas (profile_id);
alter table public.notificaciones_lecturas enable row level security;
drop policy if exists lecturas_propias_select on public.notificaciones_lecturas;
create policy lecturas_propias_select on public.notificaciones_lecturas for select to authenticated using (profile_id = auth.uid());
revoke all on public.notificaciones_lecturas from anon;
revoke insert, update, delete, truncate on public.notificaciones_lecturas from authenticated;   -- solo se escribe con notificaciones_marcar_leidas()

/* ── Ayudas de rol y audiencia ── */
create or replace function public.mi_grupo_notificacion() returns text language sql stable security definer set search_path = public as $$
  select case public.mi_rol()::text
    when 'admin_plantel' then 'admin_plantel' when 'supervisor_general' then 'admin_plantel' when 'contador_general' then 'admin_plantel' when 'supervisor_plantel' then 'admin_plantel'
    when 'secretario' then 'secretario' when 'contador_plantel' then 'secretario' when 'administrativo' then 'secretario'
    when 'inspector_general' then 'inspector' when 'docente' then 'docente' when 'estudiante' then 'alumno' when 'padre' then 'padre'
    when 'super_admin' then 'super_admin' else null end $$;

-- ¿Esta notificación está dirigida a MÍ (por rol y por curso)? Es lo que decide la bandeja.
create or replace function public._notif_coincide(p_para_roles text[], p_para_paralelos uuid[]) returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_grupo text := public.mi_grupo_notificacion(); v_labels text[];
begin
  if v_grupo is null or v_grupo = 'super_admin' then return false; end if;
  v_labels := case v_grupo when 'alumno' then array['all','todos','alumno','estudiante'] when 'padre' then array['all','todos','padre','representante'] else array['all','todos', v_grupo] end;
  if p_para_roles is null or not (p_para_roles && v_labels) then return false; end if;
  if p_para_paralelos is null or cardinality(p_para_paralelos) = 0 then return true; end if;
  if v_grupo in ('alumno', 'padre') then
    return exists (select 1 from public.ids_paralelos_familia() x where x = any (p_para_paralelos));
  elsif v_grupo = 'docente' then
    return exists (select 1 from public.docente_materia dm join public.docentes d on d.id = dm.docente_id where d.profile_id = auth.uid() and dm.paralelo_id = any (p_para_paralelos))
        or exists (select 1 from public.paralelos pa join public.docentes d on d.id = pa.tutor_docente_id where d.profile_id = auth.uid() and pa.id = any (p_para_paralelos));
  end if;
  return true;
end $$;

-- ¿Puedo LEER esta fila? Dirección (admin, secretaría, inspección) y el autor ven todo lo del plantel; los demás solo lo dirigido a ellos.
create or replace function public.notificacion_visible(p_para_roles text[], p_para_paralelos uuid[], p_created_by uuid) returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return true; end if;
  if p_created_by = auth.uid() or public.es_super_admin() then return true; end if;
  if public.mi_rol()::text in ('admin_plantel', 'secretario', 'inspector_general') then return true; end if;
  return public._notif_coincide(p_para_roles, p_para_paralelos);
end $$;

drop policy if exists familia_solo_lo_propio on public.notificaciones;
drop policy if exists solo_su_audiencia on public.notificaciones;
create policy solo_su_audiencia on public.notificaciones as restrictive for select to authenticated using (public.notificacion_visible(para_roles, para_paralelos, created_by));

-- Escritura: antes cualquier docente podía crear/editar/BORRAR cualquier notificación del plantel. Ahora: crear (roles permitidos), editar/borrar (autor o administrador).
drop policy if exists notificaciones_write on public.notificaciones;
drop policy if exists notificaciones_insert on public.notificaciones;
drop policy if exists notificaciones_update on public.notificaciones;
drop policy if exists notificaciones_delete on public.notificaciones;
create policy notificaciones_insert on public.notificaciones for insert to authenticated
  with check (es_super_admin() or (institucion_id = mi_institucion() and mi_rol() = any (array['admin_plantel'::tipo_rol, 'secretario'::tipo_rol, 'docente'::tipo_rol, 'inspector_general'::tipo_rol])));
create policy notificaciones_update on public.notificaciones for update to authenticated
  using (es_super_admin() or (institucion_id = mi_institucion() and (created_by = auth.uid() or mi_rol() = 'admin_plantel'::tipo_rol)))
  with check (es_super_admin() or (institucion_id = mi_institucion() and (created_by = auth.uid() or mi_rol() = 'admin_plantel'::tipo_rol)));
create policy notificaciones_delete on public.notificaciones for delete to authenticated
  using (es_super_admin() or (institucion_id = mi_institucion() and (created_by = auth.uid() or mi_rol() = 'admin_plantel'::tipo_rol)));

-- Validación al enviar o editar
create or replace function public.trg_notificaciones_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare v_rol text; r text; p uuid; v_doc uuid;
  v_permit text[] := array['all','todos','docente','alumno','estudiante','padre','representante','secretario','inspector','admin_plantel'];
begin
  if auth.uid() is null then return new; end if;   -- servidor / migraciones
  v_rol := public.mi_rol()::text;
  if tg_op = 'UPDATE' then
    if new.institucion_id is distinct from old.institucion_id or new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar el plantel ni el autor de una notificación.' using errcode = '42501'; end if;
  else
    new.created_by := auth.uid();   -- el autor siempre es quien envía (no se puede suplantar)
    if not public.es_super_admin() and new.institucion_id is distinct from public.mi_institucion() then
      raise exception 'Solo puedes enviar notificaciones a tu plantel.' using errcode = '42501'; end if;
  end if;
  if new.para_roles is null or cardinality(new.para_roles) = 0 then raise exception 'Elige al menos un destinatario.'; end if;
  foreach r in array new.para_roles loop
    if not (r = any (v_permit)) then raise exception 'Destinatario no válido: %', r; end if;
  end loop;
  if new.para_paralelos is not null and cardinality(new.para_paralelos) > 0 then
    if exists (select 1 from unnest(new.para_paralelos) x where not exists (select 1 from public.paralelos pa join public.grados g on g.id = pa.grado_id where pa.id = x and g.institucion_id = new.institucion_id)) then
      raise exception 'Hay cursos que no pertenecen a este plantel.'; end if;
  else
    new.para_paralelos := null;
  end if;
  if tg_op = 'INSERT' and new.expira_at is not null and new.expira_at <= now() then raise exception 'La fecha de vigencia debe ser posterior al envío.'; end if;
  if v_rol = 'docente' and not public.es_super_admin() then
    -- El docente solo avisa a estudiantes y padres de SUS cursos, sin urgencias ni emergencias
    if exists (select 1 from unnest(new.para_roles) x where x <> all (array['alumno','estudiante','padre','representante'])) then
      raise exception 'Como docente solo puedes enviar avisos a estudiantes y padres de tus cursos.' using errcode = '42501'; end if;
    if new.para_paralelos is null then raise exception 'Elige los cursos a los que enviarás el aviso.' using errcode = '42501'; end if;
    select id into v_doc from public.docentes where profile_id = auth.uid() and institucion_id = new.institucion_id limit 1;
    foreach p in array new.para_paralelos loop
      if not exists (select 1 from public.docente_materia dm where dm.docente_id = v_doc and dm.paralelo_id = p)
         and not exists (select 1 from public.paralelos pa where pa.id = p and pa.tutor_docente_id = v_doc) then
        raise exception 'Solo puedes avisar a los cursos donde enseñas o eres tutor.' using errcode = '42501'; end if;
    end loop;
    if new.prioridad = 'urgente' or new.categoria = 'emergencia' then raise exception 'Las urgencias y emergencias las envía la dirección del plantel.' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_notificaciones_validar on public.notificaciones;
create trigger trg_notificaciones_validar before insert or update on public.notificaciones for each row execute function public.trg_notificaciones_validar();

/* ── Destinatarios (interna: no se llama desde la pantalla) ── */
create or replace function public._notif_destinatarios(p_inst uuid, p_roles text[], p_paralelos uuid[])
returns table(profile_id uuid, grupo text, nombre text) language plpgsql stable security definer set search_path = public as $$
declare w_all boolean := coalesce(p_roles && array['all','todos'], false); par boolean := coalesce(cardinality(p_paralelos), 0) > 0;
begin
  return query
  select p.id, g.grupo, coalesce(nullif(btrim(coalesce(p.apellidos, '') || ' ' || coalesce(p.nombres, '')), ''), p.email, 'Sin nombre')
  from public.profiles p
  cross join lateral (select case p.rol::text when 'docente' then 'docente' when 'estudiante' then 'alumno' when 'padre' then 'padre'
      when 'secretario' then 'secretario' when 'contador_plantel' then 'secretario' when 'administrativo' then 'secretario'
      when 'inspector_general' then 'inspector' when 'admin_plantel' then 'admin_plantel' when 'supervisor_plantel' then 'admin_plantel' else null end grupo) g
  where p.institucion_id = p_inst and p.activo and g.grupo is not null
    and (w_all or (g.grupo = 'alumno' and p_roles && array['alumno','estudiante']) or (g.grupo = 'padre' and p_roles && array['padre','representante']) or g.grupo = any (p_roles))
    and (not par or g.grupo in ('secretario','inspector','admin_plantel')
      or (g.grupo = 'docente' and (exists (select 1 from public.docentes d join public.docente_materia dm on dm.docente_id = d.id where d.profile_id = p.id and dm.paralelo_id = any (p_paralelos))
                                or exists (select 1 from public.docentes d join public.paralelos pa on pa.tutor_docente_id = d.id where d.profile_id = p.id and pa.id = any (p_paralelos))))
      or (g.grupo = 'alumno' and exists (select 1 from public.estudiantes e join public.matriculas m on m.estudiante_id = e.id where e.profile_id = p.id and m.estado = 'activa' and m.paralelo_id = any (p_paralelos)))
      or (g.grupo = 'padre' and exists (select 1 from public.representantes r join public.representantes_estudiantes re on re.representante_id = r.id join public.matriculas m on m.estudiante_id = re.estudiante_id where r.profile_id = p.id and m.estado = 'activa' and m.paralelo_id = any (p_paralelos))));
end $$;

/* ── Funciones para la pantalla ── */
create or replace function public.notificaciones_bandeja(p_institucion uuid default null, p_limite integer default 80) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_inst uuid; r jsonb; v_fam boolean := public.es_familia();
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  v_inst := case when public.es_super_admin() then p_institucion else public.mi_institucion() end;
  if v_inst is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(s.j order by s.fijada desc, s.created_at desc), '[]'::jsonb) into r from (
    select n.fijada, n.created_at, jsonb_build_object(
      'id', n.id, 'titulo', n.titulo, 'cuerpo', n.cuerpo, 'para_roles', n.para_roles, 'para_paralelos', n.para_paralelos, 'prioridad', n.prioridad, 'categoria', n.categoria,
      'fijada', n.fijada, 'expira_at', n.expira_at, 'created_at', n.created_at,
      'autor', case when v_fam then null else nullif(btrim(coalesce(a.nombres, '') || ' ' || coalesce(a.apellidos, '')), '') end,   -- la familia no ve nombres del personal
      'autor_rol', a.rol, 'leida', l.profile_id is not null, 'leida_at', l.leida_at, 'es_mia', n.created_by = auth.uid()) j
    from public.notificaciones n
    left join public.profiles a on a.id = n.created_by
    left join public.notificaciones_lecturas l on l.notificacion_id = n.id and l.profile_id = auth.uid()
    where n.institucion_id = v_inst and (n.expira_at is null or n.expira_at > now())
      and (n.created_by = auth.uid() or public._notif_coincide(n.para_roles, n.para_paralelos))
    order by n.fijada desc, n.created_at desc limit greatest(1, least(coalesce(p_limite, 80), 300))
  ) s;
  return r;
end $$;

create or replace function public.notificaciones_marcar_leidas(p_ids uuid[]) returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  insert into public.notificaciones_lecturas (notificacion_id, profile_id)
  select n.id, auth.uid() from public.notificaciones n
  where n.id = any (coalesce(p_ids, '{}')) and n.institucion_id = coalesce(public.mi_institucion(), n.institucion_id)
    and (n.created_by = auth.uid() or public._notif_coincide(n.para_roles, n.para_paralelos))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.notificaciones_no_leidas(p_institucion uuid default null) returns integer language plpgsql stable security definer set search_path = public as $$
declare v_inst uuid; v_n integer;
begin
  if auth.uid() is null then return 0; end if;
  v_inst := case when public.es_super_admin() then p_institucion else public.mi_institucion() end;
  if v_inst is null then return 0; end if;
  select count(*) into v_n from public.notificaciones n
  where n.institucion_id = v_inst and (n.expira_at is null or n.expira_at > now()) and n.created_by is distinct from auth.uid()
    and public._notif_coincide(n.para_roles, n.para_paralelos)
    and not exists (select 1 from public.notificaciones_lecturas l where l.notificacion_id = n.id and l.profile_id = auth.uid());
  return v_n;
end $$;

create or replace function public.notificaciones_audiencia(p_roles text[], p_paralelos uuid[] default null, p_institucion uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_inst uuid; r jsonb;
begin
  if not (public.es_super_admin() or public.mi_rol()::text in ('admin_plantel', 'secretario', 'inspector_general', 'docente')) then raise exception 'No tienes permiso para enviar notificaciones.' using errcode = '42501'; end if;
  v_inst := case when public.es_super_admin() then p_institucion else public.mi_institucion() end;
  if v_inst is null then return jsonb_build_object('total', 0, 'por_grupo', '{}'::jsonb); end if;
  select jsonb_build_object('total', coalesce(sum(c), 0), 'por_grupo', coalesce(jsonb_object_agg(grupo, c), '{}'::jsonb)) into r
  from (select grupo, count(*) c from public._notif_destinatarios(v_inst, p_roles, p_paralelos) group by grupo) x;
  return r;
end $$;

create or replace function public.notificaciones_estadisticas(p_institucion uuid default null, p_dias integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_inst uuid; v_rol text := public.mi_rol()::text; v_desde timestamptz; v_solo_mias boolean; r jsonb; tz text := 'America/Guayaquil';
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  if not (public.es_super_admin() or v_rol in ('admin_plantel', 'secretario', 'inspector_general', 'docente')) then raise exception 'No tienes permiso para ver estas estadísticas.' using errcode = '42501'; end if;
  v_inst := case when public.es_super_admin() then p_institucion else public.mi_institucion() end;
  if v_inst is null then raise exception 'Elige un plantel.'; end if;
  p_dias := greatest(1, least(coalesce(p_dias, 30), 365));
  v_desde := (date_trunc('day', now() at time zone tz) - make_interval(days => p_dias - 1)) at time zone tz;
  v_solo_mias := (v_rol = 'docente' and not public.es_super_admin());
  with n as (
    select x.* from public.notificaciones x where x.institucion_id = v_inst and x.created_at >= v_desde and (not v_solo_mias or x.created_by = auth.uid())),
  dest as (select n.id nid, d.profile_id, d.grupo from n cross join lateral public._notif_destinatarios(n.institucion_id, n.para_roles, n.para_paralelos) d),
  lec as (select l.notificacion_id nid, l.profile_id, l.leida_at from public.notificaciones_lecturas l join n on n.id = l.notificacion_id),
  dl as (select d.nid, d.profile_id, d.grupo, l.leida_at from dest d left join lec l on l.nid = d.nid and l.profile_id = d.profile_id),
  porn as (
    select n.id, n.titulo, n.prioridad, n.categoria, n.created_at, n.fijada, n.expira_at, n.para_roles, n.para_paralelos,
           nullif(btrim(coalesce(a.nombres, '') || ' ' || coalesce(a.apellidos, '')), '') autor,
           count(dl.profile_id) destinatarios, count(dl.leida_at) leidas
    from n left join public.profiles a on a.id = n.created_by left join dl on dl.nid = n.id
    group by n.id, n.titulo, n.prioridad, n.categoria, n.created_at, n.fijada, n.expira_at, n.para_roles, n.para_paralelos, a.nombres, a.apellidos),
  dias as (select d::date dia from generate_series((v_desde at time zone tz)::date, (now() at time zone tz)::date, interval '1 day') d)
  select jsonb_build_object(
    'desde', v_desde, 'dias', p_dias, 'alcance', case when v_solo_mias then 'propias' else 'plantel' end,
    'resumen', jsonb_build_object(
      'enviadas', (select count(*) from porn),
      'destinatarios', (select coalesce(sum(destinatarios), 0) from porn),
      'lecturas', (select coalesce(sum(leidas), 0) from porn),
      'tasa_lectura', (select case when sum(destinatarios) > 0 then round(sum(leidas)::numeric * 100 / sum(destinatarios), 1) else null end from porn),
      'urgentes', (select count(*) from porn where prioridad = 'urgente'),
      'importantes', (select count(*) from porn where prioridad = 'importante'),
      'horas_medias_lectura', (select round(avg(extract(epoch from (l.leida_at - n.created_at)) / 3600)::numeric, 1) from lec l join n on n.id = l.nid where l.leida_at >= n.created_at),
      'sin_leer_48h', (select count(*) from porn where created_at < now() - interval '48 hours' and destinatarios > 0 and leidas::numeric / destinatarios < 0.5 and (expira_at is null or expira_at > now()))),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', dias.dia,
        'enviadas', (select count(*) from n where (n.created_at at time zone tz)::date = dias.dia),
        'lecturas', (select count(*) from lec where (lec.leida_at at time zone tz)::date = dias.dia)) order by dias.dia), '[]'::jsonb) from dias),
    'por_prioridad', (select coalesce(jsonb_object_agg(prioridad, c), '{}'::jsonb) from (select prioridad, count(*) c from porn group by 1) q),
    'por_categoria', (select coalesce(jsonb_object_agg(categoria, c), '{}'::jsonb) from (select categoria, count(*) c from porn group by 1) q),
    'por_grupo', (select coalesce(jsonb_agg(jsonb_build_object('grupo', grupo, 'destinatarios', dst, 'lecturas', lec_n,
        'tasa', case when dst > 0 then round(lec_n::numeric * 100 / dst, 1) else null end) order by dst desc), '[]'::jsonb)
        from (select grupo, count(*) dst, count(leida_at) lec_n from dl group by grupo) q),
    'notificaciones', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'titulo', titulo, 'prioridad', prioridad, 'categoria', categoria, 'created_at', created_at,
        'fijada', fijada, 'expira_at', expira_at, 'para_roles', para_roles, 'para_paralelos', para_paralelos, 'autor', autor, 'destinatarios', destinatarios, 'leidas', leidas,
        'tasa', case when destinatarios > 0 then round(leidas::numeric * 100 / destinatarios, 1) else null end) order by created_at desc), '[]'::jsonb)
        from (select * from porn order by created_at desc limit 150) q)
  ) into r;
  return r;
end $$;

create or replace function public.notificaciones_lectores(p_id uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare n public.notificaciones%rowtype; r jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into n from public.notificaciones where id = p_id;
  if not found then raise exception 'Notificación no encontrada.'; end if;
  if not (public.es_super_admin() or (n.institucion_id = public.mi_institucion() and (n.created_by = auth.uid() or public.mi_rol()::text in ('admin_plantel', 'secretario', 'inspector_general')))) then
    raise exception 'No tienes permiso para ver quién leyó esta notificación.' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(j order by (j->>'leida_at') is null desc, j->>'grupo', j->>'nombre'), '[]'::jsonb) into r from (
    select jsonb_build_object('nombre', d.nombre, 'grupo', d.grupo, 'leida_at', l.leida_at) j
    from public._notif_destinatarios(n.institucion_id, n.para_roles, n.para_paralelos) d
    left join public.notificaciones_lecturas l on l.notificacion_id = n.id and l.profile_id = d.profile_id limit 1500) s;
  return r;
end $$;

/* ── Permisos de ejecución ── */
revoke execute on function public.mi_grupo_notificacion(), public._notif_coincide(text[], uuid[]), public.notificacion_visible(text[], uuid[], uuid),
  public._notif_destinatarios(uuid, text[], uuid[]), public.notificaciones_bandeja(uuid, integer), public.notificaciones_marcar_leidas(uuid[]),
  public.notificaciones_no_leidas(uuid), public.notificaciones_audiencia(text[], uuid[], uuid), public.notificaciones_estadisticas(uuid, integer), public.notificaciones_lectores(uuid)
  from public, anon;
revoke execute on function public._notif_destinatarios(uuid, text[], uuid[]) from authenticated;   -- interna
grant execute on function public.mi_grupo_notificacion(), public._notif_coincide(text[], uuid[]), public.notificacion_visible(text[], uuid[], uuid), public.notificaciones_bandeja(uuid, integer),
  public.notificaciones_marcar_leidas(uuid[]), public.notificaciones_no_leidas(uuid), public.notificaciones_audiencia(text[], uuid[], uuid),
  public.notificaciones_estadisticas(uuid, integer), public.notificaciones_lectores(uuid) to authenticated;

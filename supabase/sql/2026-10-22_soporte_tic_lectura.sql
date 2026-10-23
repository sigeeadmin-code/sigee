-- Soporte TIC: funciones de lectura y acciones del Super Admin.
create or replace function public.tic_diagnostico_red(p_min int default 10) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g record; v_conx int; v_max int; v_pl jsonb; v_estado text := 'normal'; v_msg text := 'Todo funciona con normalidad.';
        n_pl int; n_sin int; n_len int; v_pct numeric;
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  p_min := greatest(3, least(coalesce(p_min,10), 60));
  select count(distinct user_id) usuarios,
         round(percentile_cont(.5) within group (order by lat_db_ms))::int db_p50,
         round(percentile_cont(.95) within group (order by lat_db_ms))::int db_p95,
         round(percentile_cont(.95) within group (order by lat_api_ms))::int api_p95,
         count(distinct user_id) filter (where fallos>0 or offline_seg>0) afectados
    into g from tic_latidos where ts > now()-make_interval(mins=>p_min);
  select conexiones into v_conx from metricas_sistema order by ts desc limit 1;
  v_max := coalesce(nullif(current_setting('max_connections', true),'')::int, 60);
  v_pct := coalesce(v_conx,0)::numeric / greatest(v_max,1);
  select coalesce(jsonb_agg(x order by x.activos desc, x.silenciosos desc), '[]'::jsonb) into v_pl from (
    select i.institucion_id, ins.nombre plantel, ins.amie,
           coalesce(a.activos,0) activos, coalesce(s.silenciosos,0) silenciosos,
           coalesce(l.usuarios,0) usuarios, l.p50 db_p50, l.p95 db_p95, l.api_p95, coalesce(l.afectados,0) afectados,
           case when coalesce(s.silenciosos,0) >= 3 and coalesce(s.silenciosos,0)::numeric / greatest(1, coalesce(s.silenciosos,0)+coalesce(a.activos,0)) >= 0.7 then 'sin_conexion'
                when coalesce(l.p95,0) > 2500 or coalesce(l.api_p95,0) > 6000 or (coalesce(l.afectados,0) >= 2 and l.afectados::numeric / greatest(1,l.usuarios) >= 0.4) then 'lento'
                else 'normal' end estado
      from (select institucion_id from tic_sesiones where institucion_id is not null and ultimo_latido > now()-interval '20 minutes' group by 1) i
      left join instituciones ins on ins.id = i.institucion_id
      left join (select institucion_id, count(distinct user_id) activos from tic_sesiones where fin is null and ultimo_latido > now()-interval '4 minutes' group by 1) a on a.institucion_id = i.institucion_id
      left join (select institucion_id, count(distinct user_id) silenciosos from tic_sesiones where fin is null and ultimo_latido <= now()-interval '4 minutes' and ultimo_latido > now()-interval '20 minutes' group by 1) s on s.institucion_id = i.institucion_id
      left join (select institucion_id, count(distinct user_id) usuarios, round(percentile_cont(.5) within group (order by lat_db_ms))::int p50,
                        round(percentile_cont(.95) within group (order by lat_db_ms))::int p95, round(percentile_cont(.95) within group (order by lat_api_ms))::int api_p95,
                        count(distinct user_id) filter (where fallos>0 or offline_seg>0) afectados
                   from tic_latidos where ts > now()-make_interval(mins=>p_min) and institucion_id is not null group by 1) l on l.institucion_id = i.institucion_id
  ) x;
  select count(*), count(*) filter (where e->>'estado'='sin_conexion'), count(*) filter (where e->>'estado'='lento') into n_pl, n_sin, n_len from jsonb_array_elements(v_pl) e;
  if v_pct >= 0.85 then
    v_estado := 'saturacion_sistema'; v_msg := 'La base de datos está cerca de su límite de conexiones: el sistema se está saturando por exceso de uso.';
  elsif n_sin >= 3 or (n_pl >= 3 and n_sin::numeric / n_pl >= 0.6) then
    v_estado := 'caida_sistema'; v_msg := 'Varios planteles dejaron de reportar a la vez: es probable una caída del sistema (Supabase/Railway) o de un proveedor de internet de la zona, no del internet de un solo plantel.';
  elsif n_len >= 3 or (n_pl >= 3 and n_len::numeric / n_pl >= 0.6) or (coalesce(g.db_p95,0) > 3000 and coalesce(g.usuarios,0) >= 5) then
    v_estado := 'saturacion_sistema'; v_msg := 'La respuesta es lenta en varios planteles a la vez: el sistema está saturado por flujo de usuarios o hay lentitud del proveedor.';
  elsif n_sin >= 1 then
    v_estado := 'caida_internet'; v_msg := n_sin || ' plantel(es) dejaron de reportar mientras los demás funcionan: es el internet de ese plantel, no el sistema.';
  elsif n_len >= 1 then
    v_estado := 'internet_lento'; v_msg := n_len || ' plantel(es) con conexión lenta mientras el resto va bien: es la conexión de ese plantel.';
  end if;
  return jsonb_build_object('estado', v_estado, 'mensaje', v_msg, 'ventana_min', p_min,
    'global', jsonb_build_object('usuarios', coalesce(g.usuarios,0), 'db_p50', g.db_p50, 'db_p95', g.db_p95, 'api_p95', g.api_p95, 'afectados', coalesce(g.afectados,0)),
    'conexiones', v_conx, 'conexiones_max', v_max, 'planteles', v_pl);
end $$;

create or replace function public.tic_tiempo_real() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  select jsonb_build_object(
    'ahora', now(),
    'conectados', (select count(distinct user_id) from tic_sesiones where fin is null and ultimo_latido > now()-interval '4 minutes'),
    'por_rol', (select coalesce(jsonb_object_agg(rol, n), '{}'::jsonb) from (select coalesce(rol,'?') rol, count(distinct user_id) n from tic_sesiones where fin is null and ultimo_latido > now()-interval '4 minutes' group by 1) t),
    'top_planteles', (select coalesce(jsonb_agg(t order by t.n desc), '[]'::jsonb) from (select ins.nombre plantel, count(distinct s.user_id) n from tic_sesiones s join instituciones ins on ins.id = s.institucion_id where s.fin is null and s.ultimo_latido > now()-interval '4 minutes' group by 1 order by 2 desc limit 8) t),
    'lat_5m', (select jsonb_build_object('db_p50', round(percentile_cont(.5) within group (order by lat_db_ms)), 'db_p95', round(percentile_cont(.95) within group (order by lat_db_ms)), 'api_p95', round(percentile_cont(.95) within group (order by lat_api_ms)), 'muestras', count(*)) from tic_latidos where ts > now()-interval '5 minutes'),
    'serie', (select coalesce(jsonb_agg(t order by t.ts), '[]'::jsonb) from (select to_timestamp(floor(extract(epoch from ts)/300)*300) ts, count(distinct user_id) usuarios, round(percentile_cont(.95) within group (order by lat_db_ms)) db_p95, round(percentile_cont(.95) within group (order by lat_api_ms)) api_p95, sum(fallos) fallos from tic_latidos where ts > now()-interval '3 hours' group by 1) t),
    'sesiones_hoy', (select count(*) from tic_sesiones where (inicio at time zone 'America/Guayaquil')::date = (now() at time zone 'America/Guayaquil')::date),
    'eventos_nuevos', (select jsonb_build_object('alta', count(*) filter (where severidad='alta'), 'media', count(*) filter (where severidad='media'), 'baja', count(*) filter (where severidad='baja')) from tic_eventos_seguridad where estado='nuevo' and ts > now()-interval '24 hours'),
    'ips_bloqueadas', (select count(*) from tic_ips_bloqueadas where activo and (hasta is null or hasta > now())),
    'diagnostico', tic_diagnostico_red(10)
  ) into r;
  return r;
end $$;

create or replace function public.tic_historial(p_q text default null, p_desde timestamptz default null, p_hasta timestamptz default null, p_inst uuid default null, p_user uuid default null, p_limite int default 300) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  return (select coalesce(jsonb_agg(t order by t.inicio desc), '[]'::jsonb) from (
    select s.id, s.user_id, s.nombre, s.email, s.rol, s.institucion_id, ins.nombre plantel, s.ip, s.user_agent, s.inicio, s.fin, s.ultimo_latido, s.motivo_fin, s.n_latidos,
           round(extract(epoch from (coalesce(s.fin, s.ultimo_latido) - s.inicio))/60.0, 1) minutos,
           (s.fin is null and s.ultimo_latido > now()-interval '5 minutes') abierta
      from tic_sesiones s left join instituciones ins on ins.id = s.institucion_id
     where s.inicio >= coalesce(p_desde, now()-interval '7 days') and s.inicio <= coalesce(p_hasta, now())
       and (p_inst is null or s.institucion_id = p_inst) and (p_user is null or s.user_id = p_user)
       and (coalesce(p_q,'') = '' or s.nombre ilike '%'||p_q||'%' or s.email ilike '%'||p_q||'%')
     order by s.inicio desc limit least(greatest(coalesce(p_limite,300),1),1000)) t);
end $$;

create or replace function public.tic_resumen_usuarios(p_q text default null, p_desde timestamptz default null, p_hasta timestamptz default null, p_inst uuid default null, p_limite int default 200) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  return (select coalesce(jsonb_agg(t order by t.minutos desc), '[]'::jsonb) from (
    select s.user_id, max(s.nombre) nombre, max(s.email) email, max(s.rol) rol, max(ins.nombre) plantel,
           count(*) ingresos, round(sum(extract(epoch from (coalesce(s.fin, s.ultimo_latido) - s.inicio))/60.0)::numeric, 1) minutos,
           round(avg(extract(epoch from (coalesce(s.fin, s.ultimo_latido) - s.inicio))/60.0)::numeric, 1) promedio_min,
           max(s.inicio) ultima_entrada, count(distinct s.ip) ips
      from tic_sesiones s left join instituciones ins on ins.id = s.institucion_id
     where s.inicio >= coalesce(p_desde, now()-interval '7 days') and s.inicio <= coalesce(p_hasta, now())
       and (p_inst is null or s.institucion_id = p_inst)
       and (coalesce(p_q,'') = '' or s.nombre ilike '%'||p_q||'%' or s.email ilike '%'||p_q||'%')
     group by s.user_id order by 6 desc limit least(greatest(coalesce(p_limite,200),1),1000)) t);
end $$;

create or replace function public.tic_uso_estadisticas(p_dias int default 14, p_inst uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_inst uuid := coalesce(p_inst, '00000000-0000-0000-0000-000000000000'); r jsonb;
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  p_dias := greatest(1, least(coalesce(p_dias,14), 90));
  with h as (select hora at time zone 'America/Guayaquil' as local, usuarios, sesiones, lat_p95 from tic_uso_hora where institucion_id = v_inst and hora > now()-make_interval(days=>p_dias))
  select jsonb_build_object(
    'heatmap', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select extract(isodow from local)::int dow, extract(hour from local)::int hr, round(avg(usuarios),1) usuarios, max(usuarios) maximo from h group by 1,2) x),
    'por_hora', (select coalesce(jsonb_agg(x order by x.hr), '[]'::jsonb) from (select extract(hour from local)::int hr, round(avg(usuarios),1) usuarios, max(usuarios) maximo, round(avg(lat_p95)) lat_p95 from h group by 1) x),
    'por_dia', (select coalesce(jsonb_agg(x order by x.dia), '[]'::jsonb) from (select local::date dia, max(usuarios) pico_usuarios, sum(sesiones) sesiones from h group by 1) x),
    'picos', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select to_char(local, 'YYYY-MM-DD HH24:00') hora, usuarios, lat_p95 from h order by usuarios desc, local desc limit 8) x),
    'sesiones', (select jsonb_build_object('total', count(*), 'usuarios', count(distinct user_id), 'promedio_min', round(avg(extract(epoch from (coalesce(fin, ultimo_latido) - inicio))/60.0)::numeric, 1))
                   from tic_sesiones where inicio > now()-make_interval(days=>p_dias) and (p_inst is null or institucion_id = p_inst)),
    'dias', p_dias
  ) into r;
  return r;
end $$;

create or replace function public.tic_latencia_usuarios(p_dias int default 3, p_inst uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  return (select coalesce(jsonb_agg(t order by t.db_p95 desc nulls last), '[]'::jsonb) from (
    select l.user_id, max(s.nombre) nombre, max(s.email) email, max(s.rol) rol, max(ins.nombre) plantel, count(*) latidos,
           round(percentile_cont(.5) within group (order by lat_db_ms))::int db_p50,
           round(percentile_cont(.95) within group (order by lat_db_ms))::int db_p95,
           round(percentile_cont(.95) within group (order by lat_api_ms))::int api_p95,
           sum(l.fallos)::int fallos, sum(l.offline_seg)::int offline_seg,
           round(100.0 * count(*) filter (where lat_db_ms > 2000) / count(*))::int pct_lentos
      from tic_latidos l left join tic_sesiones s on s.id = l.sesion_id left join instituciones ins on ins.id = l.institucion_id
     where l.ts > now()-make_interval(days=>least(greatest(coalesce(p_dias,3),1),7)) and (p_inst is null or l.institucion_id = p_inst)
     group by l.user_id having count(*) >= 3
     order by 8 desc nulls last limit 200) t);
end $$;

create or replace function public.tic_eventos(p_estado text default null, p_sev text default null, p_dias int default 7, p_ip text default null, p_incluir_login boolean default false, p_limite int default 300) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  return (select coalesce(jsonb_agg(t order by t.ts desc), '[]'::jsonb) from (
    select e.id, e.ts, e.tipo, e.severidad, e.estado, e.nota, e.ip, e.email, e.user_id, e.detalle, e.fuente, ins.nombre plantel,
           (select count(distinct s.user_id) from tic_sesiones s where s.ip = e.ip and s.inicio > now()-interval '30 days') usuarios_ip,
           exists (select 1 from tic_ips_bloqueadas b where b.ip = e.ip and b.activo and (b.hasta is null or b.hasta > now())) bloqueada
      from tic_eventos_seguridad e left join instituciones ins on ins.id = e.institucion_id
     where e.ts > now()-make_interval(days=>least(greatest(coalesce(p_dias,7),1),180))
       and (p_estado is null or e.estado = p_estado) and (p_sev is null or e.severidad = p_sev)
       and (p_ip is null or e.ip = p_ip) and (p_incluir_login or p_ip is not null or e.tipo <> 'login_fallido')
     order by e.ts desc limit least(greatest(coalesce(p_limite,300),1),1000)) t);
end $$;

create or replace function public.tic_marcar_evento(p_id bigint, p_estado text, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede hacer esto'; end if;
  if p_estado not in ('nuevo','revisado','descartado') then raise exception 'Estado inválido'; end if;
  update tic_eventos_seguridad set estado = p_estado, nota = coalesce(left(p_nota,500), nota) where id = p_id;
end $$;

create or replace function public.tic_bloquear_ip(p_ip text, p_motivo text default null, p_horas int default null) returns void
language plpgsql security definer set search_path = public as $$
declare v inet;
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede hacer esto'; end if;
  begin v := p_ip::inet; exception when others then raise exception 'IP inválida'; end;
  insert into tic_ips_bloqueadas(ip, motivo, creado_por, creado_at, hasta, activo)
  values (host(v), left(p_motivo,300), auth.uid(), now(), case when p_horas is null then null else now() + make_interval(hours => least(p_horas, 24*365)) end, true)
  on conflict (ip) do update set motivo = excluded.motivo, creado_por = excluded.creado_por, creado_at = now(), hasta = excluded.hasta, activo = true;
  insert into tic_eventos_seguridad(tipo, severidad, user_id, ip, detalle, fuente, estado) values ('ip_bloqueada','media', auth.uid(), host(v), jsonb_build_object('motivo', p_motivo, 'horas', p_horas), 'super_admin', 'revisado');
end $$;

create or replace function public.tic_desbloquear_ip(p_ip text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede hacer esto'; end if;
  update tic_ips_bloqueadas set activo = false where ip = p_ip;
  insert into tic_eventos_seguridad(tipo, severidad, user_id, ip, detalle, fuente, estado) values ('ip_desbloqueada','baja', auth.uid(), p_ip, '{}'::jsonb, 'super_admin', 'revisado');
end $$;

revoke execute on function public.tic_diagnostico_red(int), public.tic_tiempo_real(), public.tic_historial(text,timestamptz,timestamptz,uuid,uuid,int), public.tic_resumen_usuarios(text,timestamptz,timestamptz,uuid,int),
  public.tic_uso_estadisticas(int,uuid), public.tic_latencia_usuarios(int,uuid), public.tic_eventos(text,text,int,text,boolean,int), public.tic_marcar_evento(bigint,text,text),
  public.tic_bloquear_ip(text,text,int), public.tic_desbloquear_ip(text), public.tic_cerrar_huerfanas(), public.tic_agregar_uso_hora(), public.tic_purgar(), public.tic_detectar_anomalias() from anon, public;
grant execute on function public.tic_diagnostico_red(int), public.tic_tiempo_real(), public.tic_historial(text,timestamptz,timestamptz,uuid,uuid,int), public.tic_resumen_usuarios(text,timestamptz,timestamptz,uuid,int),
  public.tic_uso_estadisticas(int,uuid), public.tic_latencia_usuarios(int,uuid), public.tic_eventos(text,text,int,text,boolean,int), public.tic_marcar_evento(bigint,text,text),
  public.tic_bloquear_ip(text,text,int), public.tic_desbloquear_ip(text) to authenticated;

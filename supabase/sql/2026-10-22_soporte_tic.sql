-- Soporte TIC: accesos, seguridad, uso y red. Solo lo ve el Super Admin (es_super_admin()).
create table if not exists public.tic_sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, institucion_id uuid, rol text, email text, nombre text,
  ip text, user_agent text,
  inicio timestamptz not null default now(),
  ultimo_latido timestamptz not null default now(),
  fin timestamptz, motivo_fin text, n_latidos int not null default 0
);
create index if not exists tic_ses_user on public.tic_sesiones(user_id, inicio desc);
create index if not exists tic_ses_inst on public.tic_sesiones(institucion_id, inicio desc);
create index if not exists tic_ses_abiertas on public.tic_sesiones(ultimo_latido) where fin is null;
create index if not exists tic_ses_ip on public.tic_sesiones(ip, inicio desc);

create table if not exists public.tic_latidos (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  sesion_id uuid, user_id uuid, institucion_id uuid,
  lat_db_ms int, lat_api_ms int, fallos int not null default 0, offline_seg int not null default 0, ruta text
);
create index if not exists tic_lat_ts on public.tic_latidos(ts desc);
create index if not exists tic_lat_user on public.tic_latidos(user_id, ts desc);

create table if not exists public.tic_uso_hora (
  hora timestamptz not null,
  institucion_id uuid not null default '00000000-0000-0000-0000-000000000000', -- ceros = total global
  usuarios int, sesiones int, latidos int, lat_prom int, lat_p95 int, fallos int, offline_seg int,
  primary key (hora, institucion_id)
);

create table if not exists public.tic_eventos_seguridad (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  tipo text not null, severidad text not null default 'baja' check (severidad in ('baja','media','alta')),
  institucion_id uuid, user_id uuid, email text, ip text,
  detalle jsonb not null default '{}'::jsonb, fuente text,
  estado text not null default 'nuevo' check (estado in ('nuevo','revisado','descartado')), nota text
);
create index if not exists tic_ev_ts on public.tic_eventos_seguridad(ts desc);
create index if not exists tic_ev_ip on public.tic_eventos_seguridad(ip, ts desc);
create index if not exists tic_ev_tipo on public.tic_eventos_seguridad(tipo, ts desc);

create table if not exists public.tic_ips_bloqueadas (
  ip text primary key, motivo text, creado_por uuid, creado_at timestamptz not null default now(),
  hasta timestamptz, activo boolean not null default true
);

alter table public.tic_sesiones enable row level security;
alter table public.tic_latidos enable row level security;
alter table public.tic_uso_hora enable row level security;
alter table public.tic_eventos_seguridad enable row level security;
alter table public.tic_ips_bloqueadas enable row level security;
drop policy if exists tic_ses_sel on public.tic_sesiones; create policy tic_ses_sel on public.tic_sesiones for select to authenticated using (es_super_admin());
drop policy if exists tic_lat_sel on public.tic_latidos; create policy tic_lat_sel on public.tic_latidos for select to authenticated using (es_super_admin());
drop policy if exists tic_uso_sel on public.tic_uso_hora; create policy tic_uso_sel on public.tic_uso_hora for select to authenticated using (es_super_admin());
drop policy if exists tic_ev_sel on public.tic_eventos_seguridad; create policy tic_ev_sel on public.tic_eventos_seguridad for select to authenticated using (es_super_admin());
drop policy if exists tic_ip_sel on public.tic_ips_bloqueadas; create policy tic_ip_sel on public.tic_ips_bloqueadas for select to authenticated using (es_super_admin());
revoke all on public.tic_sesiones, public.tic_latidos, public.tic_uso_hora, public.tic_eventos_seguridad, public.tic_ips_bloqueadas from anon;
revoke insert, update, delete on public.tic_sesiones, public.tic_latidos, public.tic_uso_hora, public.tic_eventos_seguridad, public.tic_ips_bloqueadas from authenticated;

-- IP del que llama (PostgREST la deja en los encabezados de la petición)
create or replace function public.tic_ip() returns text language sql stable set search_path = public as $$
  select nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', nullif(current_setting('request.headers', true), '')::json->>'x-real-ip', ''), ',', 1)), '');
$$;

-- ===== Escritura desde la app (cualquier usuario con sesión, solo sobre lo suyo) =====
create or replace function public.tic_iniciar_sesion(p_user_agent text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid; p record; v_ip text := tic_ip();
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  select id into v from tic_sesiones
   where user_id = auth.uid() and fin is null and ultimo_latido > now() - interval '5 minutes'
     and coalesce(user_agent,'') = coalesce(left(p_user_agent,300),'') and coalesce(ip,'') = coalesce(v_ip,'')
   order by ultimo_latido desc limit 1;
  if v is not null then update tic_sesiones set ultimo_latido = now() where id = v; return v; end if;
  select institucion_id, rol::text as rol, email, btrim(coalesce(nombres,'')||' '||coalesce(apellidos,'')) as nombre into p from profiles where id = auth.uid();
  insert into tic_sesiones(user_id, institucion_id, rol, email, nombre, ip, user_agent)
  values (auth.uid(), p.institucion_id, p.rol, p.email, p.nombre, v_ip, left(p_user_agent,300)) returning id into v;
  return v;
end $$;

create or replace function public.tic_latido(p_sesion uuid, p_lat_db int default null, p_lat_api int default null, p_fallos int default 0, p_offline_seg int default 0, p_ruta text default null) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_inst uuid;
begin
  update tic_sesiones set ultimo_latido = now(), n_latidos = n_latidos + 1, fin = null, motivo_fin = null
   where id = p_sesion and user_id = auth.uid() returning institucion_id into v_inst;
  if not found then return null; end if;
  insert into tic_latidos(sesion_id, user_id, institucion_id, lat_db_ms, lat_api_ms, fallos, offline_seg, ruta)
  values (p_sesion, auth.uid(), v_inst, least(greatest(p_lat_db,0),600000), least(greatest(p_lat_api,0),600000),
          least(greatest(coalesce(p_fallos,0),0),1000), least(greatest(coalesce(p_offline_seg,0),0),86400), left(p_ruta,80));
  return now();
end $$;

create or replace function public.tic_cerrar_sesion(p_sesion uuid, p_motivo text default 'logout') returns void
language sql security definer set search_path = public as $$
  update tic_sesiones set fin = now(), motivo_fin = left(coalesce(p_motivo,'logout'),30) where id = p_sesion and user_id = auth.uid() and fin is null;
$$;

-- Login fallido (lo llama la pantalla de login, aún sin sesión). Tope anti-inundación por IP.
create or replace function public.tic_login_fallido(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_ip text := tic_ip(); v_email text := left(lower(btrim(coalesce(p_email,''))),120); v_user uuid; v_inst uuid;
begin
  if (select count(*) from tic_eventos_seguridad where tipo = 'login_fallido' and ip is not distinct from v_ip and ts > now() - interval '1 minute') >= 20 then return; end if;
  select id, institucion_id into v_user, v_inst from profiles where lower(email) = v_email limit 1;
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, ip, fuente) values ('login_fallido','baja', v_user, v_inst, v_email, v_ip, 'frontend');
end $$;
grant execute on function public.tic_login_fallido(text) to anon, authenticated;
grant execute on function public.tic_iniciar_sesion(text), public.tic_latido(uuid,int,int,int,int,text), public.tic_cerrar_sesion(uuid,text) to authenticated;
revoke execute on function public.tic_iniciar_sesion(text), public.tic_latido(uuid,int,int,int,int,text), public.tic_cerrar_sesion(uuid,text) from anon;

-- ===== Tareas programadas =====
create or replace function public.tic_cerrar_huerfanas() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update tic_sesiones set fin = ultimo_latido, motivo_fin = 'sin_latido' where fin is null and ultimo_latido < now() - interval '5 minutes';
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.tic_agregar_uso_hora() returns void language plpgsql security definer set search_path = public as $$
begin
  insert into tic_uso_hora(hora, institucion_id, usuarios, sesiones, latidos, lat_prom, lat_p95, fallos, offline_seg)
  select date_trunc('hour', ts), institucion_id, count(distinct user_id), count(distinct sesion_id), count(*),
         round(avg(lat_db_ms))::int, round(percentile_cont(0.95) within group (order by lat_db_ms))::int, sum(fallos), sum(offline_seg)
    from tic_latidos where ts >= date_trunc('hour', now()) - interval '2 hours' and institucion_id is not null group by 1,2
  on conflict (hora, institucion_id) do update set usuarios=excluded.usuarios, sesiones=excluded.sesiones, latidos=excluded.latidos, lat_prom=excluded.lat_prom, lat_p95=excluded.lat_p95, fallos=excluded.fallos, offline_seg=excluded.offline_seg;
  insert into tic_uso_hora(hora, institucion_id, usuarios, sesiones, latidos, lat_prom, lat_p95, fallos, offline_seg)
  select date_trunc('hour', ts), '00000000-0000-0000-0000-000000000000', count(distinct user_id), count(distinct sesion_id), count(*),
         round(avg(lat_db_ms))::int, round(percentile_cont(0.95) within group (order by lat_db_ms))::int, sum(fallos), sum(offline_seg)
    from tic_latidos where ts >= date_trunc('hour', now()) - interval '2 hours' group by 1
  on conflict (hora, institucion_id) do update set usuarios=excluded.usuarios, sesiones=excluded.sesiones, latidos=excluded.latidos, lat_prom=excluded.lat_prom, lat_p95=excluded.lat_p95, fallos=excluded.fallos, offline_seg=excluded.offline_seg;
end $$;

create or replace function public.tic_purgar() returns void language plpgsql security definer set search_path = public as $$
begin
  perform tic_agregar_uso_hora();
  delete from tic_latidos where ts < now() - interval '7 days';
  delete from tic_sesiones where inicio < now() - interval '180 days';
  delete from tic_eventos_seguridad where ts < now() - interval '180 days';
  delete from tic_uso_hora where hora < now() - interval '400 days';
end $$;

-- Detección de ataques externos y uso indebido interno. Solo ALERTA (no bloquea nada por sí sola).
create or replace function public.tic_detectar_anomalias() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; c int;
begin
  -- Fuerza bruta contra una cuenta: 6+ intentos fallidos en 10 min
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, ip, detalle, fuente)
  select 'fuerza_bruta_cuenta','alta', max(user_id::text)::uuid, max(institucion_id::text)::uuid, email, null,
         jsonb_build_object('intentos', count(*), 'ips_distintas', count(distinct ip)), 'detector'
    from tic_eventos_seguridad e where tipo='login_fallido' and ts > now()-interval '10 minutes' and email is not null and email <> ''
   group by email having count(*) >= 6
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='fuerza_bruta_cuenta' and x.email = e.email and x.ts > now()-interval '30 minutes');
  get diagnostics c = row_count; n := n + c;
  -- Rociado de contraseñas: una IP probando 5+ cuentas distintas en 10 min
  insert into tic_eventos_seguridad(tipo, severidad, ip, detalle, fuente)
  select 'rociado_contrasenas','alta', ip, jsonb_build_object('cuentas_distintas', count(distinct email), 'intentos', count(*)), 'detector'
    from tic_eventos_seguridad e where tipo='login_fallido' and ts > now()-interval '10 minutes' and ip is not null
   group by ip having count(distinct email) >= 5
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='rociado_contrasenas' and x.ip = e.ip and x.ts > now()-interval '30 minutes');
  get diagnostics c = row_count; n := n + c;
  -- Sondeo del servidor: 25+ respuestas 401/403/429 desde una IP en 10 min
  insert into tic_eventos_seguridad(tipo, severidad, ip, detalle, fuente)
  select 'sondeo_api','alta', ip, jsonb_build_object('peticiones_rechazadas', count(*)), 'detector'
    from tic_eventos_seguridad e where tipo in ('no_autorizado','acceso_denegado','rate_limit') and ts > now()-interval '10 minutes' and ip is not null
   group by ip having count(*) >= 25
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='sondeo_api' and x.ip = e.ip and x.ts > now()-interval '30 minutes');
  get diagnostics c = row_count; n := n + c;
  -- Escaneo de vulnerabilidades: 10+ rutas inexistentes desde una IP en 10 min
  insert into tic_eventos_seguridad(tipo, severidad, ip, detalle, fuente)
  select 'escaneo_vulnerabilidades','alta', ip, jsonb_build_object('rutas_inexistentes', count(*), 'ejemplos', (array_agg(distinct detalle->>'ruta'))[1:5]), 'detector'
    from tic_eventos_seguridad e where tipo='sondeo_ruta' and ts > now()-interval '10 minutes' and ip is not null
   group by ip having count(*) >= 10
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='escaneo_vulnerabilidades' and x.ip = e.ip and x.ts > now()-interval '30 minutes');
  get diagnostics c = row_count; n := n + c;
  -- Interno: borrados masivos (20+ DELETE en 10 min por un mismo usuario)
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, detalle, fuente)
  select 'borrado_masivo','alta', a.profile_id, max(a.institucion_id::text)::uuid, max(p.email), jsonb_build_object('borrados', count(*), 'entidades', (array_agg(distinct a.entidad))[1:6]), 'detector'
    from auditoria a left join profiles p on p.id = a.profile_id
   where a.accion = 'DELETE' and a.created_at > now()-interval '10 minutes' and a.profile_id is not null
   group by a.profile_id having count(*) >= 20
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='borrado_masivo' and x.user_id = a.profile_id and x.ts > now()-interval '1 hour');
  get diagnostics c = row_count; n := n + c;
  -- Interno: actividad masiva (150+ cambios en 10 min por un mismo usuario)
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, detalle, fuente)
  select 'actividad_masiva','media', a.profile_id, max(a.institucion_id::text)::uuid, max(p.email), jsonb_build_object('cambios', count(*), 'entidades', (array_agg(distinct a.entidad))[1:6]), 'detector'
    from auditoria a left join profiles p on p.id = a.profile_id
   where a.created_at > now()-interval '10 minutes' and a.profile_id is not null
   group by a.profile_id having count(*) >= 150
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='actividad_masiva' and x.user_id = a.profile_id and x.ts > now()-interval '1 hour');
  get diagnostics c = row_count; n := n + c;
  -- Interno: docente que modifica datos entre las 22:00 y las 05:00 (hora de Ecuador)
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, detalle, fuente)
  select 'cambio_fuera_horario','baja', a.profile_id, max(a.institucion_id::text)::uuid, max(p.email), jsonb_build_object('cambios', count(*), 'entidades', (array_agg(distinct a.entidad))[1:6]), 'detector'
    from auditoria a join profiles p on p.id = a.profile_id
   where p.rol::text = 'docente' and a.created_at > now()-interval '30 minutes'
     and (extract(hour from a.created_at at time zone 'America/Guayaquil') >= 22 or extract(hour from a.created_at at time zone 'America/Guayaquil') < 5)
   group by a.profile_id
  having not exists (select 1 from tic_eventos_seguridad x where x.tipo='cambio_fuera_horario' and x.user_id = a.profile_id and x.ts > now()-interval '12 hours');
  get diagnostics c = row_count; n := n + c;
  -- Cuenta usada desde 3+ IP distintas en 1 hora (posible clave compartida o robada)
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, detalle, fuente)
  select 'cuenta_multiples_ips','media', s.user_id, max(s.institucion_id::text)::uuid, max(s.email), jsonb_build_object('ips', array_agg(distinct s.ip)), 'detector'
    from tic_sesiones s where s.inicio > now()-interval '1 hour' and s.ip is not null
   group by s.user_id having count(distinct s.ip) >= 3
     and not exists (select 1 from tic_eventos_seguridad x where x.tipo='cuenta_multiples_ips' and x.user_id = s.user_id and x.ts > now()-interval '6 hours');
  get diagnostics c = row_count; n := n + c;
  return n;
end $$;

do $$ begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('tic_huerfanas','tic_uso_hora','tic_purgar','tic_anomalias');
  perform cron.schedule('tic_huerfanas', '*/2 * * * *', 'select public.tic_cerrar_huerfanas()');
  perform cron.schedule('tic_uso_hora', '*/10 * * * *', 'select public.tic_agregar_uso_hora()');
  perform cron.schedule('tic_anomalias', '*/5 * * * *', 'select public.tic_detectar_anomalias()');
  perform cron.schedule('tic_purgar', '0 8 * * *', 'select public.tic_purgar()');
end $$;

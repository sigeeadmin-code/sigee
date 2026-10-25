-- SIGEE · Soporte TIC · Estadísticas DIARIAS de conexiones para vigilar los límites del plan.
-- Solo LEE (tic_sesiones y metricas_sistema); no cambia datos ni estructura. Solo el Super Administrador puede ejecutarla.
-- Estima las conexiones simultáneas de tiempo real como sesiones abiertas a la vez (barrido de inicios y cierres de sesión):
-- es un tope razonable, porque cada sesión abierta puede tener una conexión de tiempo real. El dato oficial exacto está en
-- Supabase → Reports → Realtime → Connected Clients.
create or replace function public.tic_conexiones_diarias(p_dias integer default 30, p_limite_rt integer default 500)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ini timestamptz; v_max_pg int; r jsonb;
begin
  if not es_super_admin() then raise exception 'Solo el Super Administrador puede ver esto'; end if;
  p_dias := greatest(1, least(coalesce(p_dias, 30), 180));
  p_limite_rt := greatest(1, coalesce(p_limite_rt, 500));
  v_ini := (date_trunc('day', now() at time zone 'America/Guayaquil') - make_interval(days => p_dias - 1)) at time zone 'America/Guayaquil';
  v_max_pg := coalesce(nullif(current_setting('max_connections', true), '')::int, 60);
  with ses as (
    select inicio ini, user_id,
           case when fin is null and ultimo_latido > now() - interval '5 minutes' then now() else coalesce(fin, ultimo_latido) end fn
      from tic_sesiones where coalesce(fin, ultimo_latido) >= v_ini
  ),
  ev as (
    select greatest(ini, v_ini) t, 1 d from ses
    union all select fn, -1 from ses
    union all select g, 0 from generate_series(v_ini, now(), interval '1 day') g
  ),
  run as (select t, sum(d) over (order by t, d) c from ev),
  pico as (
    select (t at time zone 'America/Guayaquil')::date dia, max(c) pico, (array_agg(t order by c desc, t))[1] t_pico from run group by 1
  ),
  uso as (
    select (inicio at time zone 'America/Guayaquil')::date dia, count(*) sesiones, count(distinct user_id) usuarios
      from tic_sesiones where inicio >= v_ini group by 1
  ),
  pg as (
    select (ts at time zone 'America/Guayaquil')::date dia, max(conexiones) pico_bd from metricas_sistema where ts >= v_ini group by 1
  ),
  dias as (
    select d::date dia from generate_series((v_ini at time zone 'America/Guayaquil')::date, (now() at time zone 'America/Guayaquil')::date, interval '1 day') d
  )
  select jsonb_build_object(
    'generado', now(),
    'limite_realtime', p_limite_rt,
    'limite_bd', v_max_pg,
    'ahora', (select count(*) from tic_sesiones where fin is null and ultimo_latido > now() - interval '4 minutes'),
    'ahora_bd', (select conexiones from metricas_sistema order by ts desc limit 1),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object(
                'dia', dias.dia, 'pico', coalesce(pico.pico, 0), 'hora_pico', to_char(pico.t_pico at time zone 'America/Guayaquil', 'HH24:MI'),
                'sesiones', coalesce(uso.sesiones, 0), 'usuarios', coalesce(uso.usuarios, 0), 'pico_bd', pg.pico_bd) order by dias.dia), '[]'::jsonb)
               from dias left join pico using (dia) left join uso using (dia) left join pg using (dia))
  ) into r;
  return r;
end $$;
revoke execute on function public.tic_conexiones_diarias(integer, integer) from public, anon;
grant execute on function public.tic_conexiones_diarias(integer, integer) to authenticated;

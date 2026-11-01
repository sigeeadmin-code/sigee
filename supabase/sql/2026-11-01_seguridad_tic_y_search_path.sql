-- SIGEE · Seguridad (1 nov 2026) — ya aplicado en producción (migraciones tic_cerrar_acceso_anonimo_y_tope_global y funciones_search_path_fijo)

-- 1) Soporte TIC: estas funciones validan auth.uid() por dentro; sin usuario no hacen nada, así que no deben ser públicas.
--    tic_login_fallido SIGUE abierta a propósito: se registra antes de iniciar sesión.
revoke execute on function public.tic_cerrar_sesion(uuid, text) from public, anon;
revoke execute on function public.tic_iniciar_sesion(text) from public, anon;
revoke execute on function public.tic_latido(uuid, integer, integer, integer, integer, text) from public, anon;
revoke execute on function public.tic_reportar_denegado(text, text) from public, anon;
grant execute on function public.tic_cerrar_sesion(uuid, text) to authenticated;
grant execute on function public.tic_iniciar_sesion(text) to authenticated;
grant execute on function public.tic_latido(uuid, integer, integer, integer, integer, text) to authenticated;
grant execute on function public.tic_reportar_denegado(text, text) to authenticated;

-- 2) tic_login_fallido: el límite por IP se esquiva falsificando x-forwarded-for → tope GLOBAL de 300 eventos/minuto.
create or replace function public.tic_login_fallido(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ip text := tic_ip(); v_email text := left(lower(btrim(coalesce(p_email,''))),120); v_user uuid; v_inst uuid;
begin
  if (select count(*) from tic_eventos_seguridad where tipo = 'login_fallido' and ts > now() - interval '1 minute') >= 300 then return; end if;
  if (select count(*) from tic_eventos_seguridad where tipo = 'login_fallido' and ip is not distinct from v_ip and ts > now() - interval '1 minute') >= 20 then return; end if;
  select id, institucion_id into v_user, v_inst from profiles where lower(email) = v_email limit 1;
  insert into tic_eventos_seguridad(tipo, severidad, user_id, institucion_id, email, ip, fuente) values ('login_fallido','baja', v_user, v_inst, v_email, v_ip, 'frontend');
end $$;

-- 3) Funciones del módulo financiero y utilitarias sin search_path fijo (SECURITY INVOKER, solo usan public/pg_catalog).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and not p.prosecdef
       and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
       and (p.proname like 'financiero\_%' or p.proname like 'fn\_fin\_%' or p.proname in ('hoy_ec', 'nk_txt'))
  loop execute format('alter function %s set search_path = public, pg_temp', r.f); end loop;
end $$;
notify pgrst, 'reload schema';

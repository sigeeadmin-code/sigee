-- SIGEE · Verificación de reglas por rol. NO cambia ningún dato: todo corre dentro de una transacción que se deshace al final.
-- Cómo usarla: pegarla completa en el editor SQL de Supabase (o con la herramienta de SQL) después de CUALQUIER migración de seguridad.
-- Resultado: una tabla con cada prueba y si pasó. Si alguna dice paso = false, NO se debe dar por buena la migración.
begin;
create temp table res(n serial, prueba text, paso boolean, detalle text);
grant all on res to authenticated; grant all on res_n_seq to authenticated;
do $$
declare
  u record; esperado bigint; visto bigint; f text;
begin
  -- 1) Familia (padre / estudiante): solo ven lo suyo y nada del personal
  for u in (select distinct on (rol) rol::text r, id, institucion_id from profiles where rol in ('padre','estudiante') and activo and institucion_id is not null order by rol, id) loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    select count(*) into esperado from ids_estudiantes_familia();
    set local role authenticated;
    foreach f in array array['docentes','fichas_control','licencias_paralelo','licencias_tarifas_tramos'] loop
      execute format('select count(*) from public.%I', f) into visto;
      insert into res(prueba,paso,detalle) values (u.r||' no ve '||f, visto = 0, 'filas visibles: '||visto);
    end loop;
    select count(*) into visto from profiles;
    insert into res(prueba,paso,detalle) values (u.r||' solo ve su propio perfil', visto = 1, 'perfiles visibles: '||visto);
    select count(*) into visto from estudiantes;
    insert into res(prueba,paso,detalle) values (u.r||' solo ve a sus estudiantes', visto = esperado, 'visibles '||visto||', le corresponden '||esperado);
    select count(*) into visto from matriculas;
    insert into res(prueba,paso,detalle) values (u.r||' solo ve sus matrículas', visto <= esperado, 'visibles '||visto||', máximo '||esperado);
    select count(*) into visto from calificaciones_aportes where estudiante_id not in (select ids_estudiantes_familia());
    insert into res(prueba,paso,detalle) values (u.r||' no ve notas de otros estudiantes', visto = 0, 'notas ajenas visibles: '||visto);
    select count(*) into visto from representantes;
    insert into res(prueba,paso,detalle) values (u.r||' solo ve sus representantes', visto <= greatest(esperado*3,1), 'representantes visibles: '||visto);
    reset role;
  end loop;

  -- 2) Personal (administrador y docente): ven lo mismo que sin las reglas de familia (todo su plantel)
  for u in (select distinct on (rol) rol::text r, id, institucion_id from profiles where rol in ('admin_plantel','docente') and activo and institucion_id is not null order by rol, id) loop
    select count(*) into esperado from docentes where institucion_id = u.institucion_id;
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into visto from docentes;
    insert into res(prueba,paso,detalle) values (u.r||' ve a los docentes de su plantel', visto = esperado, 'visibles '||visto||' de '||esperado);
    reset role;
  end loop;

  -- 3) Funciones de seguridad y de horarios: el público anónimo no puede ejecutarlas
  insert into res(prueba,paso,detalle)
  select 'anónimo sin acceso a '||p.proname, not has_function_privilege('anon', p.oid, 'execute'), ''
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('aplicar_horario','guardar_catalogo_nivel','mover_bloque_horario','docente_eliminar','personal_cambiar_estado_cuenta','editar_usuario','vincular_cuenta_docente','asignar_docente_a_mi_plantel','es_familia','ids_estudiantes_familia','tic_conexiones_diarias');

  -- 4) La guarda de docentes y las reglas de familia existen
  insert into res(prueba,paso,detalle) values ('existe la guarda trg_docentes_proteger', exists(select 1 from pg_trigger where tgname='trg_docentes_proteger' and not tgisinternal), '');
  insert into res(prueba,paso,detalle)
  select 'regla familia_solo_lo_propio en '||t, exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='familia_solo_lo_propio' and permissive='RESTRICTIVE'), ''
  from unnest(array['estudiantes','matriculas','calificaciones','calificaciones_aportes','asistencia','justificaciones','docentes','profiles','representantes','docente_materia','tareas','notificaciones']) t;

  -- 5) Tiempo real: solo las dos tablas previstas
  insert into res(prueba,paso,detalle)
  select 'tiempo real solo en notificaciones y justificaciones', coalesce(string_agg(tablename, ',' order by tablename),'') = 'justificaciones,notificaciones', coalesce(string_agg(tablename, ',' order by tablename),'(ninguna)')
  from pg_publication_tables where pubname='supabase_realtime';
end $$;
select n, prueba, paso, detalle from res order by n;
rollback;

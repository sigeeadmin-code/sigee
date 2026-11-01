-- SIGEE · RLS: auth.uid() evaluado una vez por consulta (1 nov 2026) — ya aplicado (migración rls_auth_uid_initplan)
-- Misma lógica de permisos. Verificado con conteos idénticos antes/después para 6 roles (super_admin, admin_plantel, inspector, docente, estudiante, padre).
do $$
declare p record; sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') like '%auth.uid()%' or coalesce(with_check,'') like '%auth.uid()%')
      and coalesce(qual,'') not ilike '%select auth.uid()%' and coalesce(with_check,'') not ilike '%select auth.uid()%'
  loop
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then sql := sql || ' using (' || replace(p.qual, 'auth.uid()', '(select auth.uid())') || ')'; end if;
    if p.with_check is not null then sql := sql || ' with check (' || replace(p.with_check, 'auth.uid()', '(select auth.uid())') || ')'; end if;
    execute sql;
  end loop;
end $$;

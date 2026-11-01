-- SIGEE · Oficios · cierre de funciones internas (1 nov 2026) — ya aplicado en producción
-- Solo las usan otras funciones SECURITY DEFINER (corren como propietario). Nadie debe llamarlas por /rest/v1/rpc:
-- oficios_siguiente_numero consumía números del correlativo y oficios_nombre_usuario resolvía nombres por UUID.
revoke execute on function public.oficios_siguiente_numero(uuid, text) from public, anon, authenticated;
revoke execute on function public.oficios_nombre_usuario(uuid) from public, anon, authenticated;
revoke execute on function public.oficios_puede_actuar(public.oficios_documentos) from public, anon, authenticated;
revoke execute on function public.oficios_espera_seg(public.oficios_documentos) from public, anon, authenticated;
notify pgrst, 'reload schema';

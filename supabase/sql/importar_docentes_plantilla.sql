-- Importar docentes desde la plantilla Excel (Docentes → Subir plantilla).
-- Pueden usarla: super_admin (cualquier plantel), admin_plantel, secretario e inspector_general (solo su plantel).
-- Es SECURITY DEFINER para que el inspector pueda importar SIN ampliar la política de escritura de la tabla docentes.
-- Solo toca las 12 columnas de la plantilla; nunca profile_id ni institucion_id.
-- En planteles demo (es_demo) solo valida (vista previa): no guarda.
create or replace function public.importar_docentes_plantilla(p_institucion uuid, p_filas jsonb, p_solo_validar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol tipo_rol; v_inst_perfil uuid; v_inst uuid; v_es_demo boolean := false; v_guardar boolean;
  f jsonb; n int := 0; v_ced text; v_nom text; v_ape text; v_sit text; v_fecha date; v_id uuid;
  v_vistas text[] := '{}'; v_res jsonb := '[]'::jsonb; v_accion text; v_motivo text;
  c_crear int := 0; c_act int := 0; c_err int := 0;
begin
  select p.rol, p.institucion_id into v_rol, v_inst_perfil from profiles p where p.id = auth.uid();
  if v_rol is null or v_rol not in ('super_admin','admin_plantel','secretario','inspector_general') then
    raise exception 'Tu rol no puede importar docentes.' using errcode = '42501';
  end if;
  v_inst := case when v_rol = 'super_admin' then coalesce(p_institucion, v_inst_perfil) else v_inst_perfil end;
  if v_inst is null then raise exception 'Indica el plantel.' using errcode = '22023'; end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'La plantilla no tiene filas.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_filas) > 500 then raise exception 'Máximo 500 filas por carga.' using errcode = '22023'; end if;
  select coalesce(i.es_demo, false) into v_es_demo from instituciones i where i.id = v_inst;
  if not found then raise exception 'Plantel no encontrado.' using errcode = '22023'; end if;
  v_guardar := (not coalesce(p_solo_validar, true)) and not v_es_demo;

  for f in select * from jsonb_array_elements(p_filas) loop
    n := n + 1; v_motivo := null; v_accion := null; v_id := null;
    v_ced := btrim(coalesce(f->>'cedula', '')); v_nom := btrim(coalesce(f->>'nombres', '')); v_ape := btrim(coalesce(f->>'apellidos', ''));
    v_sit := upper(btrim(coalesce(nullif(f->>'situacion', ''), 'NOMBRAMIENTO')));
    begin v_fecha := nullif(btrim(coalesce(f->>'fecha_ingreso', '')), '')::date; exception when others then v_fecha := null; v_motivo := 'fecha de ingreso inválida'; end;
    if v_ced = '' then v_motivo := 'cédula vacía';
    elsif v_nom = '' then v_motivo := 'nombres vacíos';
    elsif v_ape = '' then v_motivo := 'apellidos vacíos';
    elsif v_sit not in ('NOMBRAMIENTO','CONTRATO','OCASIONAL','REEMPLAZO') then v_motivo := 'situación inválida';
    elsif v_ced = any(v_vistas) then v_motivo := 'cédula repetida en el archivo';
    end if;
    if v_ced <> '' then v_vistas := v_vistas || v_ced; end if;

    if v_motivo is null then
      select d.id into v_id from docentes d where d.institucion_id = v_inst and d.cedula = v_ced;
      v_accion := case when v_id is null then 'crear' else 'actualizar' end;
      if v_guardar then
        begin
          if v_id is null then
            insert into docentes (institucion_id, cedula, nombres, apellidos, email, telefono, titulo, cargo, situacion, especialidad, area, fecha_ingreso, genero)
            values (v_inst, v_ced, v_nom, v_ape, nullif(btrim(f->>'email'), ''), nullif(btrim(f->>'telefono'), ''), nullif(btrim(f->>'titulo'), ''),
                    nullif(btrim(f->>'cargo'), ''), v_sit, nullif(btrim(f->>'especialidad'), ''), nullif(btrim(f->>'area'), ''), v_fecha, nullif(btrim(f->>'genero'), ''));
          else
            update docentes set
              nombres = v_nom, apellidos = v_ape, situacion = v_sit,
              email = coalesce(nullif(btrim(f->>'email'), ''), email), telefono = coalesce(nullif(btrim(f->>'telefono'), ''), telefono),
              titulo = coalesce(nullif(btrim(f->>'titulo'), ''), titulo), cargo = coalesce(nullif(btrim(f->>'cargo'), ''), cargo),
              especialidad = coalesce(nullif(btrim(f->>'especialidad'), ''), especialidad), area = coalesce(nullif(btrim(f->>'area'), ''), area),
              fecha_ingreso = coalesce(v_fecha, fecha_ingreso), genero = coalesce(nullif(btrim(f->>'genero'), ''), genero), updated_at = now()
            where id = v_id;
          end if;
        exception when others then
          v_accion := 'error'; v_motivo := sqlerrm;
        end;
      end if;
    else
      v_accion := 'error';
    end if;

    if v_accion = 'crear' then c_crear := c_crear + 1; elsif v_accion = 'actualizar' then c_act := c_act + 1; else c_err := c_err + 1; end if;
    v_res := v_res || jsonb_build_object('fila', n, 'cedula', v_ced, 'accion', v_accion, 'motivo', v_motivo);
  end loop;

  return jsonb_build_object('guardado', v_guardar, 'demo', v_es_demo, 'crear', c_crear, 'actualizar', c_act, 'errores', c_err, 'filas', v_res);
end $$;
revoke all on function public.importar_docentes_plantilla(uuid, jsonb, boolean) from public, anon;
grant execute on function public.importar_docentes_plantilla(uuid, jsonb, boolean) to authenticated;

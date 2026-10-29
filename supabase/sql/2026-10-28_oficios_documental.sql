-- SIGEE · Módulo Oficios y Tráfico Documental · v1.0 (27 oct 2026)
-- SOLO AGREGA: no borra ni modifica datos existentes.
-- Principio: un caso = un documento = un PDF por versión de contenido.
-- Ruta típica: Tutor → Inspector → DECE → Vicerrector → Rector
-- Estados: borrador | en_ruta | observado | aprobado_final | entregado | archivado | rechazado

create table if not exists public.oficios_tipos (
  codigo        text primary key,
  nombre        text not null,
  descripcion   text,
  ruta_default  text[] not null default '{}',
  activo        boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.oficios_tipos (codigo, nombre, descripcion, ruta_default) values
  ('oficio_alerta',       'Oficio de alerta',          'Bajo rendimiento; citación a reunión',              array['tutor','inspector_general','rector']),
  ('ficha_tutor',         'Ficha del tutor',           'Resumen notas + asistencia',                        array['tutor','inspector_general','secretaria']),
  ('plan_refuerzo',       'Plan de refuerzo',          'Acciones, cronograma, evaluación de mejora',        array['tutor','dece','inspector_general','vicerrector']),
  ('acta_compromiso',     'Acta de compromiso',        'Reunión familia y compromisos',                    array['tutor','dece','inspector_general','rector']),
  ('oficio_faltas',       'Oficio por inasistencia',   'Notificación de faltas acumuladas',                array['tutor','inspector_general','secretaria']),
  ('informe_seguimiento', 'Informe de seguimiento',    'Evaluación de mejora (hijo del origen)',           array['tutor','inspector_general','secretaria'])
on conflict (codigo) do nothing;

create table if not exists public.oficios_documentos (
  id                    uuid primary key default gen_random_uuid(),
  institucion_id        uuid not null references public.instituciones(id) on delete cascade,
  amie                  text,
  tipo                  text not null references public.oficios_tipos(codigo),
  numero                text,
  titulo                text not null default '',
  asunto                text,
  estudiante_id         uuid references public.estudiantes(id) on delete set null,
  curso                 text,
  paralelo              text,
  periodo               text,
  emisor_id             uuid not null references public.profiles(id),
  emisor_cargo          text not null default 'tutor',
  estado                text not null default 'borrador'
                          check (estado in ('borrador','en_ruta','observado','aprobado_final','entregado','archivado','rechazado')),
  ruta                  jsonb not null default '[]'::jsonb,
  paso_actual           integer not null default 0,
  version               integer not null default 1,
  pdf_ref               text,
  pdf_hash              text,
  datos_plantilla       jsonb not null default '{}'::jsonb,
  documento_origen_id   uuid references public.oficios_documentos(id) on delete set null,
  documento_origen_numero text,
  es_seguimiento        boolean not null default false,
  historial_recorrido   jsonb not null default '[]'::jsonb,
  entrega               jsonb,
  motivo_rechazo        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  closed_at             timestamptz
);

create index if not exists oficios_doc_inst_estado_idx on public.oficios_documentos (institucion_id, estado);
create index if not exists oficios_doc_emisor_idx on public.oficios_documentos (emisor_id);
create index if not exists oficios_doc_estudiante_idx on public.oficios_documentos (estudiante_id);
create index if not exists oficios_doc_origen_idx on public.oficios_documentos (documento_origen_id);
create index if not exists oficios_doc_tipo_idx on public.oficios_documentos (tipo);
create unique index if not exists oficios_doc_numero_inst_idx on public.oficios_documentos (institucion_id, numero) where numero is not null;

create table if not exists public.oficios_correlativos (
  institucion_id  uuid not null references public.instituciones(id) on delete cascade,
  anio            integer not null,
  ultimo          integer not null default 0,
  primary key (institucion_id, anio)
);

alter table public.oficios_tipos enable row level security;
alter table public.oficios_documentos enable row level security;
alter table public.oficios_correlativos enable row level security;

drop policy if exists oficios_tipos_read on public.oficios_tipos;
create policy oficios_tipos_read on public.oficios_tipos for select to authenticated using (true);

drop policy if exists oficios_doc_select on public.oficios_documentos;
create policy oficios_doc_select on public.oficios_documentos for select to authenticated
  using (public.es_super_admin() or institucion_id = public.mi_institucion());

-- Escritura SOLO por RPC (security definer): se retiran las políticas directas
-- para que nadie salte la máquina de estados desde el cliente.
drop policy if exists oficios_doc_insert on public.oficios_documentos;
drop policy if exists oficios_doc_update on public.oficios_documentos;
drop policy if exists oficios_doc_delete on public.oficios_documentos;
drop policy if exists oficios_corr_all on public.oficios_correlativos;

-- Ver archivo completo en el repositorio para todas las funciones RPC:
-- oficios_siguiente_numero, oficios_crear_borrador, oficios_enviar,
-- oficios_aprobar_paso, oficios_observar, oficios_corregir,
-- oficios_registrar_entrega, oficios_archivar, oficios_rechazar, oficios_bandeja
--
-- IMPORTANTE: el contenido completo de las funciones está en el commit anterior
-- o se debe pegar desde la especificación. Este archivo base crea tablas + RLS.
-- Claude debe completar las funciones RPC desde el SQL completo generado.

comment on table public.oficios_documentos is 'Un caso académico/asistencia = un documento. Un PDF por versión de contenido. Firmas = acciones de usuario.';

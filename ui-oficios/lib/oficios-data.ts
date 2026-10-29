/**
 * Datos mock y tipos del módulo Oficios · Bandeja por cargo
 * Claude: reemplazar por llamadas a oficios_bandeja / oficios_* de Supabase.
 */

export type TipoDocumento =
  | 'oficio_alerta'
  | 'ficha_tutor'
  | 'plan_refuerzo'
  | 'acta_compromiso'
  | 'oficio_faltas'
  | 'informe_seguimiento';

export type Cargo =
  | 'tutor'
  | 'inspector_general'
  | 'dece'
  | 'vicerrector'
  | 'rector'
  | 'secretaria';

export type PasoRuta = {
  cargo: Cargo;
  estado: 'pendiente' | 'aprobado' | 'observado' | 'actual';
};

export type DespachoItem = {
  id: string;
  numero: string;
  asunto: string;
  tipo: TipoDocumento;
  estudiante: string;
  curso: string;
  emisor: string;
  cargoActual: Cargo;
  ruta: PasoRuta[];
  version: number;
  llegada: string;
  horasEnDespacho: number;
  devoluciones: number;
};

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  oficio_alerta: 'Oficio de alerta',
  ficha_tutor: 'Ficha del tutor',
  plan_refuerzo: 'Plan de refuerzo',
  acta_compromiso: 'Acta de compromiso',
  oficio_faltas: 'Oficio de faltas',
  informe_seguimiento: 'Informe de seguimiento',
};

export const CARGO_CORTO: Record<Cargo, string> = {
  tutor: 'Tutor',
  inspector_general: 'Inspector',
  dece: 'DECE',
  vicerrector: 'Vicerrector',
  rector: 'Rector',
  secretaria: 'Secretaría',
};

export const CARGOS_DESPACHO: { value: Cargo; label: string; pendientes: number }[] = [
  { value: 'tutor', label: 'Tutor', pendientes: 2 },
  { value: 'inspector_general', label: 'Inspector General', pendientes: 10 },
  { value: 'dece', label: 'DECE', pendientes: 4 },
  { value: 'vicerrector', label: 'Vicerrectorado', pendientes: 3 },
  { value: 'rector', label: 'Rectorado', pendientes: 1 },
  { value: 'secretaria', label: 'Secretaría', pendientes: 0 },
];

export function formatHoras(h: number): string {
  if (h < 24) return `${Math.round(h)} h`;
  const d = Math.floor(h / 24);
  const rh = Math.round(h % 24);
  return rh > 0 ? `${d} d ${rh} h` : `${d} d`;
}

export const DESPACHO: DespachoItem[] = [
  { id: 'd1', numero: '0140-2026-UEIPP', asunto: 'Alerta académica — promedio bajo en Física 2°B', tipo: 'oficio_alerta', estudiante: 'María Fernanda Correa', curso: '2° BGU B', emisor: 'Lic. Ana Torres', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'rector', estado: 'pendiente' }], version: 2, llegada: '25/10 14:20', horasEnDespacho: 79, devoluciones: 1 },
  { id: 'd2', numero: '0138-2026-UEIPP', asunto: 'Plan de refuerzo pedagógico — Matemáticas', tipo: 'plan_refuerzo', estudiante: 'Carlos Andrés Méndez', curso: '1° BGU A', emisor: 'Mgs. Pedro Ruiz', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'dece', estado: 'pendiente' }, { cargo: 'vicerrector', estado: 'pendiente' }], version: 1, llegada: '26/10 09:05', horasEnDespacho: 46, devoluciones: 0 },
  { id: 'd3', numero: '0135-2026-UEIPP', asunto: 'Oficio de inasistencias reiteradas', tipo: 'oficio_faltas', estudiante: 'Valeria Soto Paredes', curso: '3° BGU C', emisor: 'Lic. Rosa Jiménez', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'secretaria', estado: 'pendiente' }], version: 1, llegada: '26/10 16:40', horasEnDespacho: 39, devoluciones: 0 },
  { id: 'd4', numero: '0132-2026-UEIPP', asunto: 'Ficha tutorial — seguimiento socioemocional', tipo: 'ficha_tutor', estudiante: 'Diego Loor Cedeño', curso: '2° BGU A', emisor: 'Lic. Ana Torres', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'dece', estado: 'pendiente' }], version: 3, llegada: '27/10 08:15', horasEnDespacho: 24, devoluciones: 2 },
  { id: 'd5', numero: '0129-2026-UEIPP', asunto: 'Acta de compromiso con representante', tipo: 'acta_compromiso', estudiante: 'Sofía Herrera León', curso: '1° BGU B', emisor: 'Mgs. Pedro Ruiz', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'rector', estado: 'pendiente' }, { cargo: 'secretaria', estado: 'pendiente' }], version: 1, llegada: '27/10 11:00', horasEnDespacho: 21, devoluciones: 0 },
  { id: 'd6', numero: '0127-2026-UEIPP', asunto: 'Informe de seguimiento post-refuerzo', tipo: 'informe_seguimiento', estudiante: 'Andrés Quirola', curso: '3° BGU A', emisor: 'Lic. Rosa Jiménez', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }], version: 1, llegada: '27/10 15:30', horasEnDespacho: 17, devoluciones: 0 },
  { id: 'd7', numero: '0124-2026-UEIPP', asunto: 'Alerta por bajo rendimiento en Química', tipo: 'oficio_alerta', estudiante: 'Camila Vélez', curso: '2° BGU C', emisor: 'Lic. Ana Torres', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'rector', estado: 'pendiente' }], version: 1, llegada: '28/10 07:50', horasEnDespacho: 8, devoluciones: 0 },
  { id: 'd8', numero: '0121-2026-UEIPP', asunto: 'Plan de refuerzo — Lengua y Literatura', tipo: 'plan_refuerzo', estudiante: 'Mateo Castillo', curso: '1° BGU C', emisor: 'Mgs. Pedro Ruiz', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'vicerrector', estado: 'pendiente' }], version: 2, llegada: '28/10 09:20', horasEnDespacho: 6, devoluciones: 1 },
  { id: 'd9', numero: '0118-2026-UEIPP', asunto: 'Oficio de faltas injustificadas — octubre', tipo: 'oficio_faltas', estudiante: 'Isabella Ríos', curso: '3° BGU B', emisor: 'Lic. Rosa Jiménez', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'secretaria', estado: 'pendiente' }], version: 1, llegada: '28/10 10:05', horasEnDespacho: 5, devoluciones: 0 },
  { id: 'd10', numero: '0115-2026-UEIPP', asunto: 'Ficha tutorial — cambio de comportamiento', tipo: 'ficha_tutor', estudiante: 'Sebastián Mora', curso: '2° BGU B', emisor: 'Lic. Ana Torres', cargoActual: 'inspector_general', ruta: [{ cargo: 'tutor', estado: 'aprobado' }, { cargo: 'inspector_general', estado: 'actual' }, { cargo: 'dece', estado: 'pendiente' }], version: 1, llegada: '28/10 11:40', horasEnDespacho: 4, devoluciones: 0 },
];

export const ESPERA_POR_CARGO = [
  { cargo: 'Tutor', horas: 6 },
  { cargo: 'Inspector', horas: 36 },
  { cargo: 'DECE', horas: 28 },
  { cargo: 'Vicerrector', horas: 42 },
  { cargo: 'Rector', horas: 18 },
  { cargo: 'Secretaría', horas: 9 },
];

export const LLEGADAS_DIARIAS = [
  { dia: 'Lun', llegadas: 8, resueltos: 6 },
  { dia: 'Mar', llegadas: 11, resueltos: 9 },
  { dia: 'Mié', llegadas: 7, resueltos: 8 },
  { dia: 'Jue', llegadas: 12, resueltos: 7 },
  { dia: 'Vie', llegadas: 9, resueltos: 10 },
  { dia: 'Sáb', llegadas: 2, resueltos: 3 },
  { dia: 'Dom', llegadas: 0, resueltos: 1 },
];

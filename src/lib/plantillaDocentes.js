import * as XLSX from 'xlsx';
import { validarCedulaEC, normalizarFecha } from './cargaMasiva.js';

// Roles que ven Bajar/Subir plantilla en Docentes. La importación corre en la función
// importar_docentes_plantilla de Supabase (valida el rol y el plantel por su cuenta).
export const ROLES_PLANTILLA_DOCENTES = ['super_admin', 'admin_plantel', 'secretario', 'inspector_general'];

export const PLANTILLA_DOCENTES_COLS = [
  'Cédula', 'Nombres', 'Apellidos', 'Email', 'Teléfono', 'Título', 'Cargo',
  'Situación (NOMBRAMIENTO/CONTRATO/OCASIONAL/REEMPLAZO)', 'Especialidad', 'Área',
  'Fecha Ingreso (AAAA-MM-DD)', 'Género (Masculino/Femenino)'
];
export const PLANTILLA_DOCENTES_EJEMPLO = [
  '0701234567', 'Juan Carlos', 'Pérez Gómez', 'juan.perez@ejemplo.com', '0991234567',
  'Licenciado en Educación Básica', 'Docente', 'NOMBRAMIENTO', 'Matemática', 'Ciencias Exactas',
  '2020-03-15', 'Masculino'
];

const INSTRUCCIONES = [
  ['Cómo llenar la plantilla de docentes'],
  [''],
  ['1. Llena la hoja "Plantilla" desde la fila 3. La fila 2 es solo un ejemplo: bórrala o reemplázala.'],
  ['2. Obligatorios: Cédula (10 dígitos válidos), Nombres y Apellidos.'],
  ['3. Situación: NOMBRAMIENTO, CONTRATO, OCASIONAL o REEMPLAZO. Si la dejas vacía se toma NOMBRAMIENTO.'],
  ['4. Fecha de ingreso: AAAA-MM-DD (por ejemplo 2020-03-15).'],
  ['5. Género: Masculino o Femenino.'],
  ['6. Si la cédula ya existe en el plantel, se actualizan sus datos. Las celdas vacías no borran lo que ya tiene.'],
  ['7. No cambies los títulos de las columnas ni el orden de las hojas. Máximo 500 filas por carga.']
];

export function descargarPlantillaDocentes() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([PLANTILLA_DOCENTES_COLS, PLANTILLA_DOCENTES_EJEMPLO]);
  ws['!cols'] = PLANTILLA_DOCENTES_COLS.map(c => ({ wch: Math.max(14, String(c).length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  const wi = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
  wi['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones');
  XLSX.writeFile(wb, 'plantilla_docentes_sigee.xlsx');
}

// Una fila del Excel → { payload (para la función de Supabase), errores (validación local) }
export function filaAPayloadDocente(fila) {
  const t = k => String(fila[k] ?? '').trim();
  const cedula = t('Cédula');
  const nombres = t('Nombres');
  const apellidos = t('Apellidos');
  const errores = [];
  if (!cedula) errores.push('cédula vacía');
  else if (!validarCedulaEC(cedula)) errores.push('cédula inválida');
  if (!nombres) errores.push('nombres vacíos');
  if (!apellidos) errores.push('apellidos vacíos');
  const fechaCruda = t('Fecha Ingreso (AAAA-MM-DD)');
  const fecha = normalizarFecha(fechaCruda);
  if (fechaCruda && !fecha) errores.push('fecha de ingreso inválida');
  const payload = {
    cedula, nombres, apellidos,
    email: t('Email') || null,
    telefono: t('Teléfono') || null,
    titulo: t('Título') || null,
    cargo: t('Cargo') || null,
    situacion: t('Situación (NOMBRAMIENTO/CONTRATO/OCASIONAL/REEMPLAZO)').toUpperCase() || 'NOMBRAMIENTO',
    especialidad: t('Especialidad') || null,
    area: t('Área') || null,
    fecha_ingreso: fecha,
    genero: t('Género (Masculino/Femenino)') || null
  };
  return { payload, errores };
}

// Une la validación local con la respuesta de la función de Supabase.
// locales: [{payload, errores}] en el orden del archivo; respuesta: { filas:[{fila, accion, motivo}] } sobre las filas enviadas.
export function combinarResultado(locales, enviadas, respuesta) {
  const porEnviada = new Map();
  (respuesta?.filas || []).forEach(r => porEnviada.set(r.fila, r));
  return locales.map((l, idx) => {
    if (l.errores.length) return { n: idx + 2, payload: l.payload, accion: 'error', motivo: l.errores.join(', ') };
    const pos = enviadas.indexOf(idx) + 1;
    const r = porEnviada.get(pos);
    return { n: idx + 2, payload: l.payload, accion: r?.accion || 'error', motivo: r?.motivo || null };
  });
}

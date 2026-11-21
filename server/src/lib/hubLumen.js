// Hub de Colegio Lumen: qué cuentas demo puede abrir el Super Admin. Módulo puro (sin base de datos) para poder probarlo.
export const LUMEN_ID = '3327421a-ccdb-4db0-823d-92615d451d61';

// Rol del Hub -> cuenta demo de Colegio Lumen. SOLO estas cuentas pueden abrirse desde el Hub.
export const CUENTAS_HUB = {
  admin_plantel: 'demo.adminplantel@sigee.test',
  coordinador: 'demo.supervisorplantel@sigee.test',
  inspector: 'demo.inspector@sigee.test',
  docente: 'lengua.docente@sigee.test',          // docente sin tutoría
  secretaria: null,                               // TODO: no existe una cuenta demo de secretaría en Colegio Lumen (crearla y poner aquí su correo)
  tutor: 'demo.docente@sigee.test',               // tutora de 1.º de Bachillerato «A»
  psicologo: 'demo.dece@sigee.test',
  estudiante: 'demo.estudiante@sigee.test',
  representante: 'demo.padre@sigee.test'
};

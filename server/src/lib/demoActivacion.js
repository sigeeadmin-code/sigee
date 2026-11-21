// Piezas puras de la activación de demos (sin base de datos) para poder probarlas.
import crypto from 'node:crypto';

export const MAX_DEMOS_ACTIVAS = 50;

// Las 8 cuentas de cada demo. `clave` coincide con las cuentas plantilla demo.<clave>@sigee.test de Colegio Lumen.
export const CUENTAS_DEMO = [
  { clave: 'adminplantel', rol: 'Administrador del plantel' },
  { clave: 'supervisorplantel', rol: 'Supervisor del plantel' },
  { clave: 'contadorplantel', rol: 'Contador del plantel' },
  { clave: 'inspector', rol: 'Inspector general' },
  { clave: 'dece', rol: 'DECE' },
  { clave: 'docente', rol: 'Docente' },
  { clave: 'estudiante', rol: 'Estudiante' },
  { clave: 'padre', rol: 'Padre o madre de familia' }
];

const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O, 1/l/I para evitar confusiones al copiar

// Contraseña aleatoria legible: 3 grupos de 5 caracteres (≈ 85 bits).
export function claveAleatoria() {
  const grupo = () => Array.from({ length: 5 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');
  return `${grupo()}-${grupo()}-${grupo()}`;
}

export const codigoDe = (solicitudId) => String(solicitudId).replace(/-/g, '').slice(0, 6).toLowerCase();

// El admin usa el correo de quien solicita; las otras 7 cuentas usan correos de demostración que nunca reciben nada.
export function correoCuenta(clave, solicitudId, correoSolicitante) {
  if (clave === 'adminplantel') return String(correoSolicitante).trim().toLowerCase();
  return `${clave}.${codigoDe(solicitudId)}@demo.sigee.test`;
}

export const tokenValido = (t) => /^[a-f0-9]{64}$/.test(String(t || '').trim());

export const rolDeCorreo = (email) => {
  const c = CUENTAS_DEMO.find(x => String(email).toLowerCase().startsWith(x.clave + '.'));
  return c ? c.rol : 'Administrador del plantel';
};

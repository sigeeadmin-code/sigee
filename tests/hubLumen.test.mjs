import assert from 'node:assert/strict';
import { HUB_ROLES, HUB_KEY, HUB_ADMIN_KEY, LUMEN_ID, leerHub, limpiarHub, decidirLogout } from '../src/lib/hubLumen.js';
import { CUENTAS_HUB, LUMEN_ID as LUMEN_SERVIDOR } from '../server/src/lib/hubLumen.js';

// Los 9 roles, en el orden pedido
assert.deepEqual(HUB_ROLES.map(r => r.nombre), ['Admin Plantel', 'Coordinador', 'Inspector', 'Docente', 'Secretaria', 'Tutor', 'Psicólogo (DECE)', 'Estudiante', 'Representante']);
// cliente y servidor coinciden en los roles y en el id de Colegio Lumen
assert.deepEqual(HUB_ROLES.map(r => r.id).sort(), Object.keys(CUENTAS_HUB).sort());
assert.equal(LUMEN_ID, LUMEN_SERVIDOR);
// la tarjeta pendiente es exactamente la que no tiene cuenta
assert.deepEqual(HUB_ROLES.filter(r => r.pendiente).map(r => r.id), Object.keys(CUENTAS_HUB).filter(k => !CUENTAS_HUB[k]));
// solo cuentas de demostración, sin duplicados
const correos = Object.values(CUENTAS_HUB).filter(Boolean);
assert.ok(correos.every(c => c.endsWith('@sigee.test'))); assert.equal(new Set(correos).size, correos.length);
// el código del cliente no lleva contraseñas
for (const r of HUB_ROLES) assert.ok(!('password' in r) && !('clave' in r));

// storage de prueba
const mk = () => { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const st = mk();
assert.equal(leerHub(st), null);
st.setItem(HUB_KEY, JSON.stringify({ active: true, institutionId: LUMEN_ID, adminEmail: 'a@b.com' })); st.setItem(HUB_ADMIN_KEY, '{"x":1}');
assert.equal(leerHub(st).active, true);
limpiarHub(st); assert.equal(leerHub(st), null); assert.equal(st.getItem(HUB_ADMIN_KEY), null);
st.setItem(HUB_KEY, '{no es json'); assert.equal(leerHub(st), null, 'un valor dañado no rompe');

// decisión de cierre de sesión
const hub = { active: true, institutionId: LUMEN_ID, adminEmail: 'a@b.com' };
assert.equal(decidirLogout({ hub, rolDb: 'docente', institucionId: LUMEN_ID }), 'volver_hub');
assert.equal(decidirLogout({ hub: null, rolDb: 'docente', institucionId: LUMEN_ID }), 'normal', 'sin bandera: cierre normal');
assert.equal(decidirLogout({ hub: { ...hub, active: false }, rolDb: 'docente', institucionId: LUMEN_ID }), 'normal');
assert.equal(decidirLogout({ hub, rolDb: 'super_admin', institucionId: null }), 'normal', 'el Super Admin cierra por completo');
assert.equal(decidirLogout({ hub, rolDb: 'docente', institucionId: 'otro-colegio' }), 'normal', 'solo usuarios de Colegio Lumen');
console.log('hubLumen: ok');

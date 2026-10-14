import assert from 'node:assert/strict';
import { construirOficio } from '../src/lib/oficioFaltas.js';
import { normalizarOficio, oficioAHtml, oficioATexto } from '../server/src/lib/oficioCorreo.js';
import { enviarCorreo, correoConfigurado, correoValido } from '../server/src/lib/correo.js';

const alumno = {
  nombre: 'Pérez <script>alert(1)</script> Juan', cedula: '0102030405', curso: '2do Bachillerato A', faltas: 2, dias: 20, pctFaltas: 10, rachaMax: 2,
  fechasFaltas: [{ fecha: '2026-09-03', tipo: 'injustificada' }, { fecha: '2026-09-04', tipo: 'injustificada' }],
  representante: { nombres: 'Ana', apellidos: 'Pérez' }
};
const of = construirOficio({ institucion: { nombre: 'Colegio "Lumen" & Cía', amie: '07H00113', canton: 'Machala' }, alumno, periodo: { desde: '2026-09-01', hasta: '2026-09-30' }, opciones: { numero: '012-2026', ciudad: 'Machala', fechaEmision: new Date(2026, 8, 30), firmanteNombre: 'Lcdo. Juan Pérez' } });

// el oficio estructurado pasa la validación y se arma el correo
const n = normalizarOficio(JSON.parse(JSON.stringify(of)));
assert.ok(n, 'oficio válido');
const html = oficioAHtml(n);
assert.ok(html.includes('OFICIO Nro. 012-2026'));
assert.ok(html.includes('03/09/2026'));
assert.ok(!/<script>/i.test(html), 'el HTML escapa texto del cliente');
assert.ok(/&lt;script&gt;/i.test(html));
assert.ok(html.includes('&amp; Cía'));
assert.ok(oficioATexto(n).includes('ASUNTO:'));

// entradas inválidas
assert.equal(normalizarOficio(null), null);
assert.equal(normalizarOficio({ titulo: 'x' }), null);
assert.equal(normalizarOficio({ titulo: 'a', asunto: 'b', parrafos: [] }), null);
// recorta lo desmedido
const gigante = JSON.parse(JSON.stringify(of)); gigante.parrafos = Array(50).fill('x'.repeat(10000));
const g = normalizarOficio(gigante);
assert.ok(g.parrafos.length <= 10 && g.parrafos[0].length <= 4000);

// correos válidos
assert.ok(correoValido('padre@correo.com'));
assert.ok(!correoValido('padre@correo'));
assert.ok(!correoValido('a@b.com, c@d.com'));
assert.ok(!correoValido('x@y.com<z>'));

// envío: sin configuración falla claro; con configuración llama a Resend con el formato esperado
delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM;
assert.equal(correoConfigurado(), false);
await assert.rejects(() => enviarCorreo({ to: 'a@b.com', subject: 's', html: 'h', text: 't' }), e => e.codigo === 'sin_configurar');
process.env.RESEND_API_KEY = 're_prueba'; process.env.MAIL_FROM = 'SIGEE <oficios@sigee.test>';
let llamada;
const falso = async (url, init) => { llamada = { url, init, cuerpo: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ id: 'abc' }) }; };
const r = await enviarCorreo({ to: 'padre@correo.com', subject: 'Asunto', html: '<p>h</p>', text: 't', replyTo: 'inspector@colegio.edu.ec', nombreRemitente: 'Colegio "Lumen"\r\nBcc: x@y.com', fetchFn: falso });
assert.equal(r.id, 'abc');
assert.equal(llamada.url, 'https://api.resend.com/emails');
assert.equal(llamada.init.headers.Authorization, 'Bearer re_prueba');
assert.deepEqual(llamada.cuerpo.to, ['padre@correo.com']);
assert.equal(llamada.cuerpo.reply_to, 'inspector@colegio.edu.ec');
assert.ok(!/[\r\n"<>]/.test(llamada.cuerpo.from.replace(/ <oficios@sigee\.test>$/, '')), 'el nombre del remitente no admite inyección de cabeceras');
assert.ok(llamada.cuerpo.from.endsWith('<oficios@sigee.test>'));
// error del proveedor
const malo = async () => ({ ok: false, status: 422, json: async () => ({ message: 'dominio no verificado' }) });
await assert.rejects(() => enviarCorreo({ to: 'a@b.com', subject: 's', html: 'h', text: 't', fetchFn: malo }), e => e.codigo === 'proveedor' && /dominio/.test(e.message));
console.log('OK oficioCorreo: todas las pruebas pasaron');

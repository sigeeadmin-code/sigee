import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL ||= 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'x';
const { procesarAviso } = await import('../server/src/lib/avisoInasistenciaServicio.js');
const { construirAviso } = await import('../server/src/lib/avisoCorreo.js');
const { construirAvisoVista } = await import('../src/lib/avisoInasistencia.js');

const EST = '11111111-1111-4111-8111-111111111111';
const INST = '22222222-2222-4222-8222-222222222222';

// Base falsa mínima: cada tabla devuelve lo configurado; se anotan los inserts.
function baseFalsa(cfg = {}) {
  const inserts = [];
  const def = {
    estudiantes: { data: { id: EST, institucion_id: INST, nombres: 'Ana', apellidos: 'Pérez' } },
    asistencia: { data: [{ id: 'a1' }] },
    representantes_estudiantes: { data: [{ representantes: { email: 'Madre@Correo.com' } }] },
    instituciones: { data: { nombre: 'COLEGIO LUMEN' } },
    matriculas: { data: [{ grados: { nombre: '1ro Bachillerato' }, paralelos: { nombre: 'A' } }] },
    avisos_inasistencia: { data: [] }
  };
  const t = { ...def, ...cfg };
  return {
    inserts,
    from(tabla) {
      const r = t[tabla] || { data: [] };
      const q = {
        select: () => q, eq: () => q, like: () => q, limit: () => q,
        single: async () => ({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error || null }),
        insert: async fila => { inserts.push({ tabla, fila }); return { error: cfg.errorInsert || null }; },
        then: (ok, ko) => Promise.resolve({ data: r.data, error: r.error || null }).then(ok, ko)
      };
      return q;
    }
  };
}
const correo = () => { const enviados = []; return { enviados, enviarCorreo: async m => { enviados.push(m); }, correoConfigurado: () => true }; };
const entrada = (o = {}) => ({ body: { estudiante_id: EST, fecha: '2026-11-26' }, perfil: { id: 'p1', rol: 'inspector_general', institucion_id: INST }, usuario: { email: 'inspector@colegio.test' }, demo: false, ...o });

test('datos inválidos: 400 y no se envía nada', async () => {
  const c = correo();
  assert.equal((await procesarAviso({ supabase: baseFalsa(), ...c }, entrada({ body: { estudiante_id: 'x', fecha: '2026-11-26' } }))).status, 400);
  assert.equal((await procesarAviso({ supabase: baseFalsa(), ...c }, entrada({ body: { estudiante_id: EST, fecha: '26/11/2026' } }))).status, 400);
  assert.equal(c.enviados.length, 0);
});

test('un estudiante de otro plantel no se puede avisar (403); el super admin sí', async () => {
  const c = correo();
  const otro = entrada({ perfil: { id: 'p2', rol: 'inspector_general', institucion_id: '99999999-9999-4999-8999-999999999999' } });
  assert.equal((await procesarAviso({ supabase: baseFalsa(), ...c }, otro)).status, 403);
  assert.equal(c.enviados.length, 0);
  assert.equal((await procesarAviso({ supabase: baseFalsa(), ...c }, entrada({ perfil: { id: 'p3', rol: 'super_admin', institucion_id: null } }))).status, 201);
});

test('solo se avisa de una inasistencia real: sin ausencia en esa fecha, 422', async () => {
  const c = correo();
  const r = await procesarAviso({ supabase: baseFalsa({ asistencia: { data: [] } }), ...c }, entrada());
  assert.equal(r.status, 422);
  assert.match(r.body.error, /no tiene una inasistencia/);
  assert.equal(c.enviados.length, 0);
});

test('sin correo válido del representante: 422 con mensaje claro y nada se envía', async () => {
  const c = correo();
  for (const data of [[], [{ representantes: { email: '' } }], [{ representantes: { email: 'no-es-correo' } }]]) {
    const r = await procesarAviso({ supabase: baseFalsa({ representantes_estudiantes: { data } }), ...c }, entrada());
    assert.equal(r.status, 422);
    assert.match(r.body.error, /correo electrónico válido/);
  }
  assert.equal(c.enviados.length, 0);
});

test('demostración: simula el envío (200) sin enviar ni registrar nada', async () => {
  const c = correo(); const b = baseFalsa();
  const r = await procesarAviso({ supabase: b, ...c }, entrada({ demo: true }));
  assert.equal(r.status, 200);
  assert.equal(r.body.simulado, true);
  assert.deepEqual(r.body.destinos, ['madre@correo.com']);
  assert.equal(c.enviados.length, 0);
  assert.equal(b.inserts.length, 0);
});

test('servidor sin correo configurado: 501', async () => {
  const c = correo();
  const r = await procesarAviso({ supabase: baseFalsa(), ...c, correoConfigurado: () => false }, entrada());
  assert.equal(r.status, 501);
  assert.equal(c.enviados.length, 0);
});

test('éxito: envía una vez a los correos de la base, deja constancia y no obedece un destinatario del cliente', async () => {
  const c = correo(); const b = baseFalsa({ representantes_estudiantes: { data: [{ representantes: { email: 'Madre@Correo.com' } }, { representantes: { email: 'madre@correo.com' } }, { representantes: { email: 'padre@correo.com' } }, { representantes: { email: 'otro@correo.com' } }] } });
  const e = entrada(); e.body.to = ['atacante@malo.com']; e.body.html = '<b>contenido del cliente</b>';
  const r = await procesarAviso({ supabase: b, ...c }, e);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.destinos, ['madre@correo.com', 'padre@correo.com']);   // sin duplicados y máximo 2
  assert.equal(c.enviados.length, 1);
  assert.deepEqual(c.enviados[0].to, ['madre@correo.com', 'padre@correo.com']);
  assert.equal(c.enviados[0].replyTo, 'inspector@colegio.test');
  assert.match(c.enviados[0].subject, /Ana Pérez/);
  assert.doesNotMatch(JSON.stringify(c.enviados[0]), /atacante|contenido del cliente/);
  assert.equal(b.inserts.length, 1);
  assert.equal(b.inserts[0].tabla, 'avisos_inasistencia');
  assert.match(b.inserts[0].fila.mensaje, /^Aviso por correo a madre@correo\.com, padre@correo\.com/);
  assert.equal(b.inserts[0].fila.enviado_por, 'p1');
  assert.equal(b.inserts[0].fila.fecha, '2026-11-26');
});

test('doble envío: si ya se mandó, 409; con reenviar sí se envía', async () => {
  const c = correo();
  const previo = baseFalsa({ avisos_inasistencia: { data: [{ id: 'av1' }] } });
  const r1 = await procesarAviso({ supabase: previo, ...c }, entrada());
  assert.equal(r1.status, 409); assert.equal(r1.body.yaEnviado, true); assert.equal(c.enviados.length, 0);
  const e = entrada(); e.body.reenviar = true;
  assert.equal((await procesarAviso({ supabase: baseFalsa({ avisos_inasistencia: { data: [{ id: 'av1' }] } }), ...c }, e)).status, 201);
  assert.equal(c.enviados.length, 1);
});

test('si el proveedor falla: 502 y NO queda registrado como avisado', async () => {
  const b = baseFalsa();
  const falla = { correoConfigurado: () => true, enviarCorreo: async () => { const e = new Error('dominio no verificado'); e.codigo = 'proveedor'; throw e; } };
  const r = await procesarAviso({ supabase: b, ...falla }, entrada());
  assert.equal(r.status, 502);
  assert.match(r.body.error, /No se pudo enviar/);
  assert.equal(b.inserts.length, 0);
});

test('el texto de la vista previa del cliente es idéntico al que arma el servidor', () => {
  const datos = { institucion: 'COLEGIO LUMEN', estudiante: 'Ana Pérez', curso: '1ro Bachillerato A', fecha: '2026-11-26' };
  const srv = construirAviso(datos); const cli = construirAvisoVista(datos);
  assert.equal(cli.asunto, srv.asunto);
  assert.equal(cli.texto, srv.texto);
  assert.match(srv.texto, /jueves, 26 de noviembre de 2026/);
});

test('el HTML del correo escapa lo que viene de la base', () => {
  const { html } = construirAviso({ institucion: '<script>x</script>', estudiante: '<img src=x onerror=1>', curso: '', fecha: '2026-11-26' });
  assert.doesNotMatch(html, /<script>x|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

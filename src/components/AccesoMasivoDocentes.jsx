import React, { useEffect, useMemo, useState } from 'react';
import { fetchDocentesSinAcceso, crearUsuario } from '../lib/data.js';
import { generarClave } from '../lib/claves.js';
import { exportarFilasExcel } from '../lib/cargaMasiva.js';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Alta de accesos para TODOS los docentes del plantel que aún no tienen cuenta.
// Usa el correo de la ficha; si no tiene, genera "cédula@dominio". Cada docente recibe una contraseña temporal distinta
// y al final se descarga un Excel con usuarios y contraseñas (la contraseña no se puede volver a consultar).
export default function AccesoMasivoDocentes({ institucion, onClose, onDone }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [dominio, setDominio] = useState('sigee.test');
  const [fase, setFase] = useState('config');   // config | creando | listo
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    fetchDocentesSinAcceso(institucion.id).then(setLista).catch(e => setError(e.message || 'No se pudo cargar la lista.'));
  }, [institucion.id]);

  const dom = dominio.trim().toLowerCase().replace(/^@/, '');
  const plan = useMemo(() => (lista || []).map(d => {
    const propio = (d.email || '').trim().toLowerCase();
    const usaPropio = EMAIL_OK.test(propio);
    const ced = String(d.cedula || '').trim();
    const correo = usaPropio ? propio : (ced && dom ? `${ced}@${dom}` : '');
    return { d, correo, propio: usaPropio };
  }), [lista, dom]);
  const sinCorreo = plan.filter(p => !p.correo).length;
  const conPropio = plan.filter(p => p.propio).length;

  async function crear() {
    const trabajos = plan.filter(p => p.correo);
    if (!trabajos.length) return;
    if (!window.confirm(`Se crearán ${trabajos.length} accesos de docente en ${institucion.nombre}. ¿Continuar?`)) return;
    setFase('creando'); setAvance({ hechos: 0, total: trabajos.length }); setResultados([]);
    const out = []; let i = 0, hechos = 0;
    async function worker() {
      while (i < trabajos.length) {
        const p = trabajos[i++];
        const clave = generarClave();
        const fila = { cedula: p.d.cedula || '', nombre: `${p.d.apellidos || ''} ${p.d.nombres || ''}`.trim(), correo: p.correo, clave, ok: false, detalle: '' };
        try {
          await crearUsuario({ email: p.correo, password: clave, rol: 'docente', docente_id: p.d.id, nombres: p.d.nombres || fila.nombre, apellidos: p.d.apellidos || fila.nombre, cedula: p.d.cedula || undefined, telefono: p.d.telefono || undefined });
          fila.ok = true;
        } catch (err) {
          let msg = err.message || 'No se pudo crear.';
          try { const j = await err.context?.json?.(); if (j?.error) msg = j.error; } catch (_) { /* mensaje genérico */ }
          fila.detalle = msg; fila.clave = '';
        }
        out.push(fila); hechos++; setAvance({ hechos, total: trabajos.length });
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    out.sort((a, b) => a.nombre.localeCompare(b.nombre));
    setResultados(out); setFase('listo'); onDone?.();
  }

  function descargar() {
    exportarFilasExcel(`accesos_docentes_${(institucion.amie || 'plantel')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      resultados.map(r => ({ 'Cédula': r.cedula, 'Apellidos y nombres': r.nombre, 'Usuario (correo)': r.correo, 'Contraseña temporal': r.clave, 'Resultado': r.ok ? 'Acceso creado' : 'No creado: ' + r.detalle })));
  }

  const ok = resultados.filter(r => r.ok).length;
  return (
    <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget && fase !== 'creando') onClose(); }}>
      <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-h"><h3>🔑 Dar acceso a todos los docentes</h3></div>
        <div className="modal-b">
          {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
          {!lista && !error && <p className="muted">Cargando docentes…</p>}
          {lista && fase === 'config' && (
            <>
              <p style={{ fontSize: 13.5, marginTop: 0 }}><strong>{lista.length}</strong> docentes activos todavía no tienen acceso. Se creará un usuario para cada uno, con contraseña temporal propia.</p>
              <ul style={{ fontSize: 13, color: 'var(--slate)', paddingLeft: 18 }}>
                <li>{conPropio} usarán el correo que ya tienen en su ficha.</li>
                <li>{plan.length - conPropio - sinCorreo} no tienen correo: su usuario será <code>cédula@{dom || 'dominio'}</code>.</li>
                {sinCorreo > 0 && <li style={{ color: 'var(--red)' }}>{sinCorreo} no se podrán crear (sin correo ni cédula).</li>}
              </ul>
              <label className="fl">Dominio para los docentes sin correo</label>
              <input className="fc" value={dominio} onChange={e => setDominio(e.target.value)} placeholder="sigee.test" />
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Ese correo sirve solo para iniciar sesión (no recibe mensajes). Por defecto se usa un dominio reservado que no pertenece a nadie. Cada docente podrá cambiar su contraseña al entrar.</p>
            </>
          )}
          {fase === 'creando' && (
            <div>
              <p style={{ fontSize: 13.5 }}>Creando accesos… {avance.hechos} de {avance.total}. No cierres esta ventana.</p>
              <div style={{ height: 10, background: 'var(--line)', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${avance.total ? (avance.hechos / avance.total) * 100 : 0}%`, background: 'var(--blue, #2563eb)', transition: 'width .2s' }} /></div>
            </div>
          )}
          {fase === 'listo' && (
            <>
              <p style={{ fontSize: 13.5, marginTop: 0 }}><strong>{ok}</strong> accesos creados{resultados.length - ok > 0 ? <>, <strong style={{ color: 'var(--red)' }}>{resultados.length - ok}</strong> con problemas</> : ''}.</p>
              <p style={{ fontSize: 13, background: 'rgba(245,158,11,.12)', padding: 10, borderRadius: 8 }}>⚠️ Descarga ahora el Excel con los usuarios y contraseñas: <strong>las contraseñas no se pueden volver a consultar</strong>. Entrégalas por un canal seguro.</p>
              <button className="btn btn-primary" onClick={descargar}>⬇️ Descargar Excel de accesos</button>
              {resultados.some(r => !r.ok) && (
                <div style={{ marginTop: 12, fontSize: 12.5 }}>
                  <strong>No se pudieron crear:</strong>
                  <ul style={{ paddingLeft: 18 }}>{resultados.filter(r => !r.ok).map(r => <li key={r.correo + r.cedula}>{r.nombre} — {r.detalle}</li>)}</ul>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-f">
          {fase === 'config' && <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>}
          {fase === 'config' && <button className="btn btn-primary" disabled={!lista || plan.length - sinCorreo === 0} onClick={crear}>Crear {plan.length - sinCorreo} accesos</button>}
          {fase === 'listo' && <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>}
        </div>
      </div>
    </div>
  );
}

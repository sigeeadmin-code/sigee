import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { leerExcel, exportarFilasExcel } from '../lib/cargaMasiva.js';
import { filaAPayloadDocente, combinarResultado, descargarPlantillaDocentes } from '../lib/plantillaDocentes.js';

const ETIQUETA = { crear: ['b-ok', 'Se creará'], actualizar: ['b-warn', 'Ya existe: se actualizará'], error: ['b-err', 'Error'] };

// Subir la plantilla de docentes: 1) lee el Excel, 2) revisa fila por fila (la función de Supabase dice qué se crea,
// qué se actualiza y qué falla, sin guardar), 3) guarda solo si la persona confirma.
// institucionId: plantel de trabajo. Si es null (Super Admin en vista global) se elige el plantel aquí.
export default function ModalPlantillaDocentes({ institucionId, planteles = [], onClose, onGuardado }) {
  const [plantelId, setPlantelId] = useState(institucionId || '');
  const [estado, setEstado] = useState({ fase: 'inicio', filas: [], locales: [], enviadas: [], demo: false, error: '', resumen: null });
  const [trabajando, setTrabajando] = useState(false);
  const elegirPlantel = !institucionId;
  const [busq, setBusq] = useState('');
  const [opciones, setOpciones] = useState(planteles.map(([id, nombre]) => ({ id, nombre, amie: '' })));
  useEffect(() => {
    if (!elegirPlantel || busq.trim().length < 2) return undefined;
    const t = setTimeout(() => {
      const q = busq.trim().replace(/[%,()]/g, ' ');
      supabase.from('instituciones').select('id, nombre, amie').eq('activo', true)
        .or(`nombre.ilike.%${q}%,amie.ilike.%${q}%`).order('nombre').limit(30)
        .then(({ data }) => setOpciones(data || []), () => {});
    }, 300);
    return () => clearTimeout(t);
  }, [busq, elegirPlantel]);

  async function onArchivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (elegirPlantel && !plantelId) { setEstado(s => ({ ...s, error: 'Elige primero el plantel.' })); return; }
    setTrabajando(true);
    try {
      const crudas = (await leerExcel(file)).filter(f => Object.values(f).some(v => String(v).trim() !== ''));
      if (!crudas.length) throw new Error('El archivo no tiene filas. Usa la plantilla descargada desde aquí.');
      if (crudas.length > 500) throw new Error('Máximo 500 filas por carga. Divide el archivo.');
      if (!('Cédula' in crudas[0])) throw new Error('No encuentro la columna "Cédula". Usa la plantilla descargada desde aquí y no cambies los títulos.');
      const locales = crudas.map(filaAPayloadDocente);
      const enviadas = locales.map((l, i) => (l.errores.length ? -1 : i)).filter(i => i >= 0);
      let respuesta = { filas: [], demo: false };
      if (enviadas.length) {
        const { data, error } = await supabase.rpc('importar_docentes_plantilla', {
          p_institucion: plantelId || null, p_filas: enviadas.map(i => locales[i].payload), p_solo_validar: true
        });
        if (error) throw new Error(error.message);
        respuesta = data;
      }
      const filas = combinarResultado(locales, enviadas, respuesta);
      setEstado({ fase: 'revision', filas, locales, enviadas, demo: !!respuesta.demo, error: '', resumen: null });
    } catch (err) {
      setEstado(s => ({ ...s, fase: 'inicio', error: err.message || String(err) }));
    }
    setTrabajando(false);
  }

  const crear = estado.filas.filter(f => f.accion === 'crear').length;
  const actualizar = estado.filas.filter(f => f.accion === 'actualizar').length;
  const conError = estado.filas.filter(f => f.accion === 'error').length;
  const guardables = crear + actualizar;

  async function guardar() {
    if (!guardables || estado.demo) return;
    setTrabajando(true);
    try {
      const ok = estado.enviadas.filter((_, pos) => ['crear', 'actualizar'].includes(estado.filas[estado.enviadas[pos]]?.accion));
      const { data, error } = await supabase.rpc('importar_docentes_plantilla', {
        p_institucion: plantelId || null, p_filas: ok.map(i => estado.locales[i].payload), p_solo_validar: false
      });
      if (error) throw new Error(error.message);
      setEstado(s => ({ ...s, fase: 'listo', resumen: data, error: '' }));
      onGuardado?.();
    } catch (err) {
      setEstado(s => ({ ...s, error: 'No se pudo guardar: ' + (err.message || err) }));
    }
    setTrabajando(false);
  }

  function bajarErrores() {
    const filas = estado.filas.filter(f => f.accion === 'error').map(f => ({ 'Fila del Excel': f.n, 'Cédula': f.payload.cedula, 'Nombres': f.payload.nombres, 'Apellidos': f.payload.apellidos, 'Problema': f.motivo }));
    exportarFilasExcel('errores_plantilla_docentes.xlsx', filas);
  }

  const r = estado.resumen;
  return (
    <div className="modal-bg" onClick={() => !trabajando && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <h3>📤 Subir plantilla de docentes</h3>

        {estado.fase !== 'listo' && (
          <>
            <p style={{ color: 'var(--slate)', fontSize: 13 }}>
              Sube la plantilla llena. Primero se revisa fila por fila y no se guarda nada hasta que confirmes. Si la cédula ya existe en el plantel, se actualizan sus datos.
            </p>
            {elegirPlantel && (
              <div style={{ marginBottom: 10 }}>
                <label className="fl">Plantel</label>
                <input className="fc" placeholder="Busca por nombre o AMIE (mínimo 2 letras)" value={busq} onChange={e => setBusq(e.target.value)} disabled={trabajando || estado.fase === 'revision'} style={{ marginBottom: 6 }} />
                <select className="fc" value={plantelId} onChange={e => setPlantelId(e.target.value)} disabled={trabajando || estado.fase === 'revision'}>
                  <option value="">Elige el plantel…</option>
                  {opciones.map(o => <option key={o.id} value={o.id}>{o.amie ? `${o.amie} · ` : ''}{o.nombre}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={descargarPlantillaDocentes}>⬇️ Bajar plantilla</button>
              <label className="btn btn-primary" style={{ cursor: trabajando ? 'wait' : 'pointer' }}>
                {trabajando && estado.fase === 'inicio' ? 'Revisando…' : estado.fase === 'revision' ? '📂 Elegir otro archivo' : '📂 Elegir archivo'}
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} disabled={trabajando} onChange={onArchivo} />
              </label>
            </div>
          </>
        )}

        {estado.error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{estado.error}</p>}

        {estado.fase === 'revision' && (
          <>
            {estado.demo && (
              <p style={{ fontSize: 13, background: 'var(--amberXL)', color: 'var(--amberD)', padding: '8px 10px', borderRadius: 8 }}>
                Este plantel es una demostración: esta es solo la vista previa y no se guarda nada.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
              <span className="badge b-ok">{crear} se crearán</span>
              <span className="badge b-warn">{actualizar} se actualizarán</span>
              <span className="badge b-err">{conError} con error</span>
              <span style={{ fontSize: 12, color: 'var(--slate)', alignSelf: 'center' }}>{estado.filas.length} filas leídas</span>
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table className="tbl">
                <thead><tr><th>Fila</th><th>Cédula</th><th>Docente</th><th>Resultado</th></tr></thead>
                <tbody>
                  {estado.filas.map(f => {
                    const [cls, txt] = ETIQUETA[f.accion] || ETIQUETA.error;
                    return (
                      <tr key={f.n}>
                        <td>{f.n}</td>
                        <td className="mono">{f.payload.cedula || '—'}</td>
                        <td>{`${f.payload.apellidos} ${f.payload.nombres}`.trim() || '—'}</td>
                        <td><span className={`badge ${cls}`}>{f.accion === 'error' ? `⚠️ ${f.motivo}` : txt}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {estado.fase === 'listo' && r && (
          <div style={{ padding: 12, background: 'var(--bg-soft)', borderRadius: 8 }}>
            <p><strong>{r.crear}</strong> docente{r.crear === 1 ? '' : 's'} creado{r.crear === 1 ? '' : 's'} y <strong>{r.actualizar}</strong> actualizado{r.actualizar === 1 ? '' : 's'}.</p>
            {r.errores > 0 && (
              <>
                <p style={{ color: 'var(--red)' }}>{r.errores} fila(s) no se guardaron:</p>
                <ul style={{ fontSize: 12, color: 'var(--red)' }}>
                  {r.filas.filter(f => f.accion === 'error').map(f => <li key={f.fila}>{f.cedula}: {f.motivo}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="modal-f" style={{ justifyContent: 'space-between' }}>
          <div>{estado.fase === 'revision' && conError > 0 && <button className="btn btn-ghost" onClick={bajarErrores}>⬇️ Bajar errores</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" disabled={trabajando} onClick={onClose}>{estado.fase === 'listo' ? 'Cerrar' : 'Cancelar'}</button>
            {estado.fase === 'revision' && !estado.demo && (
              <button className="btn btn-primary" disabled={trabajando || guardables === 0} onClick={guardar}>
                {trabajando ? 'Guardando…' : `✅ Guardar ${guardables} docente${guardables === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

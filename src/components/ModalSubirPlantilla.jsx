import React, { useRef, useState } from 'react';

const MAX_BYTES = 5 * 1024 * 1024;
const fmt = n => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Estados: vacio → seleccionado → cargando → exito | error.
// `onProcesar(file)` valida y guarda; devuelve { ok, errores?, resumen? }. Este componente solo se ocupa de la interfaz.
export default function ModalSubirPlantilla({ contexto, onProcesar, onCerrar }) {
  const [estado, setEstado] = useState('vacio');
  const [archivo, setArchivo] = useState(null);
  const [errores, setErrores] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const input = useRef(null);
  const ocupado = estado === 'cargando';

  const elegir = f => {
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { setErrores(['El archivo debe ser una plantilla de Excel (.xlsx).']); setEstado('error'); setArchivo(null); return; }
    if (f.size > MAX_BYTES) { setErrores(['El archivo supera los 5 MB.']); setEstado('error'); setArchivo(null); return; }
    setArchivo(f); setErrores([]); setEstado('seleccionado');
  };
  const reiniciar = () => { setArchivo(null); setErrores([]); setResumen(null); setEstado('vacio'); if (input.current) input.current.value = ''; };
  const procesar = async () => {
    setEstado('cargando');
    const r = await onProcesar(archivo);
    if (r.ok) { setResumen(r.resumen); setEstado('exito'); } else { setErrores(r.errores || ['No se pudo procesar el archivo.']); setEstado('error'); }
  };

  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pl-titulo">
        <div className="modal-h">
          <h3 id="pl-titulo">Subir plantilla de calificaciones</h3>
          <button className="btn btn-secondary btn-sm" onClick={onCerrar} disabled={ocupado} aria-label="Cerrar"><span className="ti ti-x" /></button>
        </div>
        <div className="modal-b">
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--slate)' }}>
            Sube la plantilla de Excel que descargaste y llenaste. Solo se actualizan las notas que cambiaste; las celdas vacías no borran nada.
          </p>

          {(estado === 'vacio' || estado === 'seleccionado' || estado === 'error') && !archivo && (
            <div className={'pl-dz' + (arrastrando ? ' on' : '')} role="button" tabIndex={0}
              onClick={() => input.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
              onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={e => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]); }}>
              <span className="ti ti-cloud-upload" />
              <div style={{ fontWeight: 600, marginTop: 6 }}>Arrastra tu plantilla aquí</div>
              <div style={{ fontSize: 12, color: 'var(--slate)' }}>o haz clic para elegir el archivo · .xlsx · máx. 5 MB</div>
            </div>
          )}
          <input ref={input} type="file" accept=".xlsx" hidden onChange={e => elegir(e.target.files?.[0])} />

          {archivo && estado !== 'exito' && (
            <div className="pl-arch">
              <span className="ti ti-file-spreadsheet" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{archivo.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--slate)' }}>{fmt(archivo.size)}</div>
              </div>
              {!ocupado && <button className="btn btn-secondary btn-sm" onClick={reiniciar}>Quitar</button>}
            </div>
          )}

          <div className="pl-ctx" aria-label="Contexto (solo lectura)">
            <div><b>Curso</b>{contexto.curso}</div>
            <div><b>Paralelo</b>{contexto.paralelo}</div>
            <div><b>Materia</b>{contexto.materia}</div>
            <div><b>Trimestre</b>{contexto.trimestre}</div>
          </div>

          {estado === 'error' && (
            <div role="alert" style={{ marginTop: 14 }}>
              <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}><span className="ti ti-alert-circle" /> No se guardó ninguna nota</div>
              <ul className="pl-errs">{errores.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <div style={{ fontSize: 12, color: 'var(--slate)', marginTop: 6 }}>Corrige el archivo y vuelve a subirlo. Nada se guarda hasta que todo esté correcto.</div>
            </div>
          )}
          {estado === 'exito' && (
            <div role="status" style={{ marginTop: 14, color: 'var(--green)', fontSize: 13.5, fontWeight: 600 }}>
              <span className="ti ti-circle-check" />{' '}
              {resumen && resumen.estudiantes > 0
                ? `Listo: se actualizaron ${resumen.celdas} nota(s) de ${resumen.estudiantes} estudiante(s).`
                : 'La plantilla es válida, pero no tenía notas nuevas: no hubo cambios.'}
            </div>
          )}
        </div>
        <div className="modal-f">
          {estado === 'exito'
            ? <button className="btn btn-primary" onClick={onCerrar}>Cerrar</button>
            : <>
              <button className="btn btn-secondary" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
              <button className="btn btn-primary" onClick={procesar} disabled={!archivo || ocupado}>
                {ocupado ? <><span className="spin" />Procesando…</> : 'Subir y procesar'}
              </button>
            </>}
        </div>
      </div>
    </div>
  );
}

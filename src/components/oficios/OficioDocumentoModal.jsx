import React, { useEffect, useMemo, useState } from 'react';
import OficioHoja, { AnexoRecorrido, HojaAjustada } from './OficioHoja.jsx';
import { EstadoBadge } from './OficioUI.jsx';

/**
 * Visor del documento generado. Lectura: «vista de entrega» (limpia) y «vista con recorrido» (anexo interno).
 * Edición (emisor en borrador u observado): se escribe directo sobre la hoja y «Aplicar cambios» los devuelve al detalle.
 */
export default function OficioDocumentoModal({ doc, editable = false, institucion, nombreEstudiante, onAplicar, onImprimir, onCerrar }) {
  const [vista, setVista] = useState('entrega');
  const [hoja, setHoja] = useState(doc.datos_plantilla?.documento || null);
  const [cambio, setCambio] = useState(false);
  const docVista = useMemo(() => (hoja ? { ...doc, datos_plantilla: { ...doc.datos_plantilla, documento: hoja } } : doc), [doc, hoja]);

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onCerrar]);

  const pedir = modo => onImprimir(modo);
  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !cambio) onCerrar(); }}>
      <div className="modal ofd-visor" role="dialog" aria-modal="true" aria-labelledby="ofd-vis-t">
        <div className="modal-h">
          <h3 id="ofd-vis-t">{editable ? 'Editar documento' : 'Documento'} <span className="ofd-num">{doc.numero}</span></h3>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><EstadoBadge estado={doc.estado} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar} aria-label="Cerrar"><span className="ti ti-x" /></button></span>
        </div>
        {!editable && (
          <div className="ofd-visor-bar" style={{ padding: '8px 16px' }}>
            <div className="ofd-seg" role="group" aria-label="Vista del documento">
              <button type="button" aria-pressed={vista === 'entrega'} onClick={() => setVista('entrega')}>Vista de entrega</button>
              <button type="button" aria-pressed={vista === 'recorrido'} onClick={() => setVista('recorrido')}>Vista con recorrido</button>
            </div>
          </div>
        )}
        {editable && <p className="ofd-sub" style={{ padding: '8px 16px 0' }}>Haz clic sobre el texto para corregirlo. Los cambios se aplican al guardar el trámite.</p>}
        <div className="modal-b">
          <HojaAjustada>
            <OficioHoja doc={docVista} editable={editable && !!hoja} onCambio={h => { setHoja(h); setCambio(true); }} institucion={institucion} nombreEstudiante={nombreEstudiante} />
            {!editable && vista === 'recorrido' && <AnexoRecorrido doc={doc} />}
          </HojaAjustada>
        </div>
        <div className="modal-f">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>{editable && cambio ? 'Descartar' : 'Cerrar'}</button>
          {editable
            ? <button type="button" className="btn btn-primary" disabled={!cambio} onClick={() => onAplicar(hoja)}>Aplicar cambios</button>
            : doc.estado !== 'borrador' && <button type="button" className="btn btn-primary" onClick={() => pedir(vista)}><span className="ti ti-printer" /> Imprimir {vista === 'recorrido' ? 'con recorrido' : 'para entrega'}</button>}
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { editarTexto, editarCampo, editarCelda, agregarFila, quitarFila, marcarItem, editarItem, editarFirma, editarCabecera } from '../lib/fichasRendimiento.js';

const leer = el => (typeof el.innerText === 'string' ? el.innerText : el.textContent) || '';

/** Texto editable en la propia hoja. Se guarda al salir del campo (así no salta el cursor al escribir). */
function Ed({ valor, onCambio, editable, className = '', tag: Tag = 'span', placeholder }) {
  if (!editable) return <Tag className={'of-ed ' + className}>{valor}</Tag>;
  return (
    <Tag className={'of-ed ' + className} contentEditable suppressContentEditableWarning spellCheck data-placeholder={placeholder}
      onBlur={e => { const t = leer(e.currentTarget).replace(/\u00a0/g, ' ').replace(/\n$/, ''); if (t !== valor) onCambio(t); }}>{valor}</Tag>
  );
}

/**
 * Dibuja un documento estructurado (ver fichasRendimiento.js). editable=true: se escribe directo sobre la hoja y se
 * pueden agregar/quitar filas; editable=false: vista de impresión (sin controles ni avisos).
 */
export default function DocumentoEditable({ doc, onCambio, editable = false }) {
  return (
    <div className={'oficio-hoja' + (editable ? ' oficio-edit' : '')}>
      <div className="of-cab">
        <div className="of-inst"><Ed editable={editable} valor={doc.cabecera.institucion} onCambio={t => onCambio(editarCabecera(doc, 'institucion', t))} /></div>
        {doc.cabecera.amie && <div className="of-sub"><Ed editable={editable} valor={doc.cabecera.amie} onCambio={t => onCambio(editarCabecera(doc, 'amie', t))} /></div>}
        <div className="of-sub"><Ed editable={editable} valor={doc.cabecera.subtitulo} onCambio={t => onCambio(editarCabecera(doc, 'subtitulo', t))} /></div>
      </div>

      {doc.bloques.map(b => {
        if (b.t === 'texto') return <div key={b.id} className={'of-p' + (b.alin === 'derecha' ? ' der' : b.alin === 'centro' ? ' cen' : '') + (b.negrita ? ' neg' : '') + (b.menor ? ' menor' : '')}><Ed editable={editable} valor={b.texto} onCambio={t => onCambio(editarTexto(doc, b.id, t))} /></div>;
        if (b.t === 'subtitulo') return <div key={b.id} className="of-subt"><Ed editable={editable} valor={b.texto} onCambio={t => onCambio(editarTexto(doc, b.id, t))} /></div>;
        if (b.t === 'campos') return (
          <div key={b.id} className="of-campos" style={{ gridTemplateColumns: `repeat(${b.cols || 1}, 1fr)` }}>
            {b.filas.map(([e, v], i) => <div key={i} className="of-campo"><b>{e}:</b><Ed editable={editable} valor={v} onCambio={t => onCambio(editarCampo(doc, b.id, i, t))} /></div>)}
          </div>
        );
        if (b.t === 'tabla') return (
          <div key={b.id}>
            <table className="of-tabla">
              <thead><tr>{b.cols.map((c, j) => <th key={j}>{c}</th>)}{editable && <th className="no-imprimir" style={{ width: 22 }} />}</tr></thead>
              <tbody>
                {b.filas.map((f, i) => (
                  <tr key={i}>
                    {f.map((c, j) => <td key={j}><Ed editable={editable} valor={c} onCambio={t => onCambio(editarCelda(doc, b.id, i, j, t))} /></td>)}
                    {editable && <td className="no-imprimir"><button type="button" className="of-x" title="Quitar fila" aria-label="Quitar fila" onClick={() => onCambio(quitarFila(doc, b.id, i))}>✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <div className="of-mas no-imprimir"><button type="button" className="btn btn-ghost btn-sm" onClick={() => onCambio(agregarFila(doc, b.id))}>+ Agregar fila</button></div>}
          </div>
        );
        if (b.t === 'lista') return (
          <div key={b.id} className="of-lista">
            {b.items.map((it, i) => (
              <div key={i} className="of-item">
                {editable
                  ? <span className="of-check" role="checkbox" aria-checked={it.marcado} tabIndex={0} onClick={() => onCambio(marcarItem(doc, b.id, i, !it.marcado))} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onCambio(marcarItem(doc, b.id, i, !it.marcado)); } }}>{it.marcado ? '☑' : '☐'}</span>
                  : <span className="of-check">{it.marcado ? '☑' : '☐'}</span>}
                <Ed editable={editable} valor={it.texto} onCambio={t => onCambio(editarItem(doc, b.id, i, t))} />
              </div>
            ))}
          </div>
        );
        if (b.t === 'firmas') return (
          <div key={b.id} className="of-firmas">
            {b.firmas.map((f, i) => (
              <div key={i} className="of-firma">
                <div className="of-linea" style={{ width: '85%' }} />
                <div><Ed editable={editable} valor={f.nombre} placeholder="Nombre" onCambio={t => onCambio(editarFirma(doc, b.id, i, 'nombre', t))} /></div>
                <div style={{ fontWeight: 700 }}><Ed editable={editable} valor={f.cargo} onCambio={t => onCambio(editarFirma(doc, b.id, i, 'cargo', t))} /></div>
              </div>
            ))}
          </div>
        );
        return null;
      })}

      <div className="of-pie">{doc.pie}</div>
      {editable && <div className="of-pie no-imprimir" style={{ color: '#b91c1c' }}>{doc.aviso}</div>}
    </div>
  );
}

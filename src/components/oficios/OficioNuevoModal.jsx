import React, { useState } from 'react';
import { TIPOS_DOCUMENTO } from '../../lib/oficiosDocumental.js';
import { periodoPorDefecto } from '../../lib/oficiosVista.js';
import EstudiantePicker from './EstudiantePicker.jsx';
import { TRIMESTRES, tieneConstructor } from '../../lib/documentoOficio.js';

const VACIO = () => ({ tipo: 'oficio_alerta', titulo: '', asunto: '', estudiante: null, trimestre: 'T1', curso: '', paralelo: '', periodo: periodoPorDefecto() });

/** Alta de un documento nuevo (crea el borrador; el contenido se redacta en el detalle). */
export default function OficioNuevoModal({ estudiantes, guardando, onCrear, onCerrar }) {
  const [f, setF] = useState(VACIO);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const elegir = e => setF(x => ({ ...x, estudiante: e, curso: e?.curso || '', paralelo: e?.paralelo || '' }));
  const valido = f.titulo.trim().length >= 3;

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <form className="modal ofd-modal" onSubmit={e => { e.preventDefault(); if (valido) onCrear(f); }} aria-labelledby="ofd-nuevo-t">
        <div className="modal-h"><h3 id="ofd-nuevo-t">Nuevo documento</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCerrar} aria-label="Cerrar"><span className="ti ti-x" /></button></div>
        <div className="modal-b">
          <div className="form-grid">
            <div className="full">
              <label className="fl" htmlFor="ofd-tipo">Tipo de documento</label>
              <select id="ofd-tipo" className="fc" value={f.tipo} onChange={e => set('tipo', e.target.value)}>
                {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </select>
              <small className="ofd-ayuda">{TIPOS_DOCUMENTO[f.tipo]?.uso}</small>
            </div>
            <div className="full">
              <label className="fl" htmlFor="ofd-titulo">Título</label>
              <input id="ofd-titulo" className="fc" value={f.titulo} onChange={e => set('titulo', e.target.value)} required maxLength={160}
                placeholder="Ej. Citación por bajo rendimiento en Matemática" />
            </div>
            <div className="full">
              <label className="fl" htmlFor="ofd-est">Estudiante</label>
              <EstudiantePicker id="ofd-est" estudiantes={estudiantes} value={f.estudiante?.id} onChange={elegir} />
            </div>
            {tieneConstructor(f.tipo) && f.estudiante && (
              <div className="full"><label className="fl" htmlFor="ofd-trim">Trimestre del informe</label>
                <select id="ofd-trim" className="fc" value={f.trimestre} onChange={e => set('trimestre', e.target.value)}>
                  {TRIMESTRES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <small className="ofd-ayuda">La hoja se arma con las notas reales de ese trimestre.</small></div>
            )}
            <div><label className="fl" htmlFor="ofd-curso">Curso</label>
              <input id="ofd-curso" className="fc" value={f.curso} onChange={e => set('curso', e.target.value)} /></div>
            <div><label className="fl" htmlFor="ofd-par">Paralelo</label>
              <input id="ofd-par" className="fc" value={f.paralelo} onChange={e => set('paralelo', e.target.value)} /></div>
            <div className="full"><label className="fl" htmlFor="ofd-per">Período lectivo</label>
              <input id="ofd-per" className="fc" value={f.periodo} onChange={e => set('periodo', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-f">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!valido || guardando}>{guardando ? 'Armando documento…' : 'Crear borrador'}</button>
        </div>
      </form>
    </div>
  );
}

import React from 'react';
import { createPortal } from 'react-dom';
import { colorDeMateria } from '../lib/horarioUI.js';
import { altoFilaMm, fechaEmision } from '../lib/impresionHorario.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const raiz = () => { let el = document.getElementById('hor-doc-root'); if (!el) { el = document.createElement('div'); el.id = 'hor-doc-root'; document.body.appendChild(el); } return el; };

function Membrete({ institucion: i, periodo, titulo, subtitulo }) {
  const logo = i?.logo || i?.logo_url;
  const zona = [i?.zona && `Zona ${String(i.zona).replace(/^zona\s*/i, '')}`, i?.distrito_nombre && `Distrito ${i.distrito_nombre}`, i?.circuito && `Circuito ${i.circuito}`].filter(Boolean).join(' · ');
  const ubic = [i?.parroquia, i?.canton, i?.provincia].filter(Boolean).join(', ');
  return (
    <>
      <div className="hd-cab">
        <div>{logo && <img className="hd-logo" src={logo} alt="" />}</div>
        <div className="hd-cen">
          <div className="hd-rep">República del Ecuador</div>
          <div className="hd-min">Ministerio de Educación</div>
          {zona && <div className="hd-zona">{zona}</div>}
          <div className="hd-ie">{i?.nombre || 'Institución educativa'}</div>
          <div className="hd-ubi">AMIE: {i?.amie || '—'}{ubic ? ' · ' + ubic : ''}</div>
        </div>
        <div className="hd-der">
          <div><b>Año lectivo</b>{periodo?.nombre || '—'}</div>
          <div style={{ marginTop: '1mm' }}><b>Régimen</b>{i?.regimen || '—'}</div>
        </div>
      </div>
      <div className="hd-titulo">{titulo}</div>
      {subtitulo && <div className="hd-sub">{subtitulo}</div>}
    </>
  );
}

function Ficha({ items }) {
  return (
    <div className="hd-ficha">
      {items.filter(Boolean).map(([k, v, ancho]) => (
        <div key={k} style={ancho ? { gridColumn: `span ${ancho}` } : undefined}><b>{k}</b>{v || '—'}</div>
      ))}
    </div>
  );
}

function TablaSemana({ franjas, bloques, resolverEtiqueta, aulaEtiqueta }) {
  const en = (dia, f) => bloques.find(b => b.dia === dia && b.franja === f);
  const denso = franjas.filter(f => f.tipo === 'clase').length >= 9;   // jornadas largas: letra y espacios más compactos para seguir en UNA hoja
  return (
    <div className={'hd-una' + (denso ? ' hd-denso' : '')}>
      <table className="hd-t" style={{ '--fila': altoFilaMm(franjas) + 'mm' }}>
        <thead><tr><th className="hd-h" /> {DIAS.map(d => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>
          {franjas.map(f => f.tipo === 'recreo'
            ? <tr key={f.label}><td className="hd-h">{f.label}</td><td className="hd-rec" colSpan={DIAS.length}>RECREO</td></tr>
            : <tr key={f.label}>
              <td className="hd-h">{f.label}</td>
              {DIAS.map(d => {
                const b = en(d, f.label); const info = b ? resolverEtiqueta(b) : null;
                if (!info) return <td key={d} className="hd-c" />;
                const aula = b.aula_id ? aulaEtiqueta(b.aula_id) : '';
                return (
                  <td key={d} className="hd-c" style={{ '--c': colorDeMateria(info.materia).bd }}>
                    <div className="hd-m">{info.materia}</div>
                    {info.sub && <div className="hd-s">{info.sub}</div>}
                    {aula && <div className="hd-a">Aula: {aula}</div>}
                  </td>
                );
              })}
            </tr>)}
        </tbody>
      </table>
    </div>
  );
}

// Un día, todos los cursos: filas = paralelos, columnas = horas de clase. Puede ocupar varias hojas; el encabezado de la tabla se repite.
function TablaDia({ filas, clases, matriz, cargaPorId }) {
  return (
    <table className="hd-t hd-dia" style={{ '--fila': '11mm' }}>
      <thead><tr><th className="hd-h" style={{ width: '38mm' }}>Curso</th>{clases.map(f => <th key={f.label}>{f.label}</th>)}</tr></thead>
      <tbody>{filas.map(({ id, nombre, tipo }) => (
        <tr key={id}>
          <td className="hd-h" style={{ textAlign: 'left' }}><b>{nombre}</b><div className="hd-a">{tipo}</div></td>
          {clases.map(f => {
            const b = (matriz[id] || {})[f.label]; const c = b ? cargaPorId[b.docente_materia_id] : null;
            return c
              ? <td key={f.label} className="hd-c" style={{ '--c': colorDeMateria(c.materiaNombre).bd }}><div className="hd-m">{c.materiaNombre}</div><div className="hd-s">{c.docenteNombre}</div></td>
              : <td key={f.label} className="hd-c" />;
          })}
        </tr>
      ))}</tbody>
    </table>
  );
}

/** Contenido del documento (sin portal): útil también para pruebas. */
export function ContenidoHorario({ institucion, periodo, titulo, subtitulo, ficha, firmas, semana, dia }) {
  return (
    <div className="hd">
      <Membrete institucion={institucion} periodo={periodo} titulo={titulo} subtitulo={subtitulo} />
      <Ficha items={ficha} />
      {semana && <TablaSemana {...semana} />}
      {dia && <TablaDia {...dia} />}
      <div className="hd-firmas">
        {firmas.map(([cargo, nombre]) => <div key={cargo} className="hd-firma">{nombre || <>&nbsp;</>}<small>{cargo}</small></div>)}
      </div>
      <div className="hd-pie"><span>{institucion?.nombre}{periodo?.nombre ? ' · ' + periodo.nombre : ''}</span><span>Emitido el {fechaEmision()} · Generado por SIGEE</span></div>
    </div>
  );
}

/** Se dibuja siempre pero oculto en pantalla (#hor-doc-root); solo aparece al imprimir (ver styles.css). */
export default function DocumentoHorario(props) {
  if (typeof document === 'undefined') return null;
  return createPortal(<ContenidoHorario {...props} />, raiz());
}

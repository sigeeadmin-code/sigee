import React from 'react';
import { ETIQUETA_ESTADO, barraClase, franjaActual, motivoSinAccion, puedeMarcarAtraso, textoRestan } from '../lib/resumenDia.js';

export function Pildora({ fondo, color, children }) {
  return <span className="rd-pill" style={{ background: fondo, color }}>{children}</span>;
}

export default function TarjetaClaseDia({ c, hora, rolDb, seleccion, onAlternar, onTodos, onMarcar }) {
  const et = ETIQUETA_ESTADO[c.estado] || ETIQUETA_ESTADO.pendiente;
  const barra = barraClase(c);
  const puede = puedeMarcarAtraso(rolDb, c);
  const motivo = motivoSinAccion(rolDb, c);
  const fr = c.en_hora ? franjaActual(c.franjas, hora) : null;
  const marcados = seleccion || new Set();
  const nAus = (c.lista_ausentes || []).length;

  return (
    <div className="rd-clase">
      <div className="rd-clase-h">
        <span className="rd-hora" title="Franjas de esta materia hoy">{c.inicio}–{c.fin}</span>
        <span className="rd-mat">{c.materia}</span>
        <span className="rd-cur">{c.curso} «{c.paralelo}» · {c.estudiantes} estudiantes</span>
        <span style={{ flex: 1 }} />
        <Pildora fondo={et.fondo} color={et.color}>{c.estado === 'en_curso' ? '● ' : ''}{et.txt}</Pildora>
      </div>

      {c.estado === 'registrada' && (
        <>
          <div className="rd-bar" role="img" aria-label={`Presentes ${c.presentes}, atrasos ${c.atrasos}, ausentes ${c.ausentes}, justificados ${c.justificados}`}>
            <i style={{ width: `${barra.presentes}%`, background: 'var(--green)' }} />
            <i style={{ width: `${barra.atrasos}%`, background: 'var(--amber)' }} />
            <i style={{ width: `${barra.justificados}%`, background: 'var(--blue)' }} />
            <i style={{ width: `${barra.ausentes}%`, background: 'var(--red)' }} />
          </div>
          <div className="rd-cnt">
            <span><b>{c.presentes}</b> presentes</span><span><b>{c.atrasos}</b> atrasos</span>
            <span><b>{c.ausentes}</b> ausentes</span><span><b>{c.justificados}</b> justificados</span>
          </div>
        </>
      )}
      {c.estado === 'sin_registro' && <div className="rd-err">El docente no registró la asistencia de esta clase y la hora ya terminó. Puede registrarla Inspección desde Asistencia → Clases sin registro.</div>}
      {c.estado === 'en_curso' && <p className="rd-note">La clase está en curso y el docente aún no registra la asistencia.</p>}
      {c.estado === 'pendiente' && <p className="rd-note">Todavía no es la hora de esta clase ({c.franjas}).</p>}

      {nAus > 0 && (
        <div className={'rd-aus' + (puede ? '' : ' off')}>
          <h4>
            Ausentes registrados por el docente ({nAus})
            {puede && fr && <Pildora fondo="var(--amberXL)" color="var(--amberD)">⏱ {textoRestan(fr.restan)} en esta hora</Pildora>}
          </h4>
          <div className="rd-list">
            {c.lista_ausentes.map(e => (
              <label key={e.id} className={'rd-est' + (marcados.has(e.id) ? ' on' : '')} style={!puede ? { cursor: 'default' } : undefined}>
                {puede && <input type="checkbox" checked={marcados.has(e.id)} onChange={() => onAlternar(e.id)} />}
                <span>{e.nombre}</span>
              </label>
            ))}
          </div>
          {puede ? (
            <div className="rd-acc">
              <button type="button" className="btn btn-primary" disabled={marcados.size === 0} onClick={() => onMarcar(marcados)}>
                Llegó tarde: registrar atraso{marcados.size ? ` (${marcados.size})` : ''}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onTodos(marcados.size === nAus ? new Set() : new Set(c.lista_ausentes.map(e => e.id)))}>
                {marcados.size === nAus ? 'Quitar selección' : 'Seleccionar todos'}
              </button>
              <p className="rd-note">Los que no marques siguen como ausentes. La hora es la actual y no se puede cambiar.</p>
            </div>
          ) : motivo && <p className="rd-note">ℹ️ {motivo}</p>}
        </div>
      )}

      {(c.lista_atrasos || []).length > 0 && (
        <div>
          <p className="rd-note" style={{ marginBottom: 6 }}>Atrasos de esta clase</p>
          <div className="rd-atr">{c.lista_atrasos.map(a => <span key={a.id}>{a.nombre}{a.hora ? ` · ${a.hora}` : ''}</span>)}</div>
        </div>
      )}
    </div>
  );
}

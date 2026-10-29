'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Search, Eye, CheckCircle2, MessageSquareWarning, Ban, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, Columns3, PartyPopper, ShieldAlert, Info, RefreshCw, X,
} from 'lucide-react';
import {
  DESPACHO, CARGOS_DESPACHO, TIPO_LABEL, CARGO_CORTO, formatHoras,
  type DespachoItem, type TipoDocumento, type Cargo,
} from '@/lib/oficios-data';
import { TipoBadge, VersionChip } from '@/components/ui/Badge';
import { RouteMini } from '@/components/ui/RouteStepper';
import Tooltip from '@/components/ui/Tooltip';
import EmptyState from '@/components/ui/EmptyState';
import TableSkeleton from '@/components/ui/TableSkeleton';
import DespachoActionModals, { type AccionDespacho } from '@/app/bandeja-por-cargo/components/DespachoActionModals';

type SortKey = 'espera' | 'numero' | 'version' | 'estudiante';
const COLUMNAS = [
  { key: 'numero', label: 'N° documento' }, { key: 'asunto', label: 'Asunto' }, { key: 'tipo', label: 'Tipo' },
  { key: 'estudiante', label: 'Estudiante' }, { key: 'curso', label: 'Curso' }, { key: 'emisor', label: 'Emisor' },
  { key: 'ruta', label: 'Ruta' }, { key: 'version', label: 'Versión' }, { key: 'llegada', label: 'Llegada' },
  { key: 'espera', label: 'Espera / SLA' },
] as const;
type ColKey = (typeof COLUMNAS)[number]['key'];

function semaforo(h: number): { tono: 'ok' | 'warn' | 'bad'; texto: string } {
  if (h > 48) return { tono: 'bad', texto: 'Vencido' };
  if (h > 24) return { tono: 'warn', texto: 'Por vencer' };
  return { tono: 'ok', texto: 'A tiempo' };
}
const TONO_BAR = { ok: 'bg-success', warn: 'bg-warning', bad: 'bg-destructive' } as const;
const TONO_TXT = { ok: 'text-success', warn: 'text-warning', bad: 'text-destructive' } as const;

export default function DespachoTable() {
  const [cargo, setCargo] = useState<Cargo>('inspector_general');
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<TipoDocumento | 'todos'>('todos');
  const [solo, setSolo] = useState<'todos' | 'vencidos' | 'reenviados'>('todos');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'espera', dir: 'desc' });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(8);
  const [resueltos, setResueltos] = useState<string[]>([]);
  const [saliendo, setSaliendo] = useState<string[]>([]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [colsVisibles, setColsVisibles] = useState<ColKey[]>(COLUMNAS.map((c) => c.key));
  const [menuCols, setMenuCols] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [accion, setAccion] = useState<{ tipo: AccionDespacho; doc: DespachoItem } | null>(null);

  const esMiCargo = cargo === 'inspector_general';
  const base = useMemo(() => (!esMiCargo ? [] : DESPACHO.filter((d) => !resueltos.includes(d.id))), [esMiCargo, resueltos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const list = base.filter((d) => {
      if (tipo !== 'todos' && d.tipo !== tipo) return false;
      if (solo === 'vencidos' && d.horasEnDespacho <= 48) return false;
      if (solo === 'reenviados' && d.devoluciones === 0) return false;
      if (q && !`${d.numero} ${d.asunto} ${d.estudiante} ${d.emisor}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case 'numero': return a.numero.localeCompare(b.numero) * dir;
        case 'version': return (a.version - b.version) * dir;
        case 'estudiante': return a.estudiante.localeCompare(b.estudiante) * dir;
        default: return (a.horasEnDespacho - b.horasEnDespacho) * dir;
      }
    });
  }, [base, tipo, solo, busqueda, sort]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);
  const todosMarcados = visibles.length > 0 && visibles.every((d) => seleccion.includes(d.id));
  const mostrar = (k: ColKey) => colsVisibles.includes(k);
  const vencidos = base.filter((d) => d.horasEnDespacho > 48).length;

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  const refrescar = () => {
    setCargando(true);
    setTimeout(() => { setCargando(false); toast.success('Cola de despacho actualizada'); }, 650);
  };

  const confirmar = (a: AccionDespacho, doc: DespachoItem) => {
    setAccion(null);
    setSaliendo((s) => [...s, doc.id]);
    setTimeout(() => {
      setResueltos((r) => [...r, doc.id]);
      setSaliendo((s) => s.filter((x) => x !== doc.id));
      setSeleccion((s) => s.filter((x) => x !== doc.id));
      if (a === 'aprobar') toast.success(`Paso aprobado: ${doc.numero} avanza a Rectorado`);
      if (a === 'observar') toast.success(`${doc.numero} devuelto a ${doc.emisor} con observación`);
      if (a === 'rechazar') toast.success(`${doc.numero} rechazado y cerrado`);
    }, 260);
  };

  const aprobarMasivo = () => {
    // Claude: oficios_aprobar_paso por cada id
    toast.success(`${seleccion.length} documentos aprobados y enviados al siguiente cargo`);
    setResueltos((r) => [...r, ...seleccion]);
    setSeleccion([]);
  };

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 font-semibold transition-colors duration-150 hover:text-foreground ${sort.key === k ? 'text-primary' : ''}`}>
      {children}
      {sort.key === k && (sort.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
    </button>
  );

  return (
    <section aria-label="Cola de documentos por despachar" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Cola de despacho</h2>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
              Ordenada por tiempo de espera · actualizada 28/10/2026 08:40
            </p>
          </div>
          <button type="button" onClick={refrescar} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95">
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto scroll-thin pb-1" role="tablist" aria-label="Seleccionar cargo">
          {CARGOS_DESPACHO.map((c) => {
            const active = cargo === c.value;
            return (
              <button key={`cargo-${c.value}`} type="button" role="tab" aria-selected={active}
                onClick={() => { setCargo(c.value); setPagina(1); setSeleccion([]); }}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-secondary-foreground hover:bg-muted'
                }`}>
                {c.label}
                <span className={`rounded-full px-1.5 text-[11px] font-bold tabular ${
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{c.value === 'inspector_general' ? base.length : c.pendientes}</span>
              </button>
            );
          })}
        </div>

        {!esMiCargo && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 px-3 py-2.5 text-sm text-info">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Solo puedes actuar sobre los documentos que están en el paso de tu cargo (Inspector General). La cola de otros cargos es de solo lectura.</p>
          </div>
        )}
        {esMiCargo && vencidos > 0 && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium">{vencidos} documento{vencidos > 1 ? 's' : ''} supera{vencidos > 1 ? 'n' : ''} las 48 horas en tu despacho. Prioriza los de mayor espera.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <span className="sr-only">Buscar en la cola</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="Buscar por N°, estudiante, asunto o emisor…"
            className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25" />
        </label>
        <select aria-label="Filtrar por tipo de documento" value={tipo} onChange={(e) => { setTipo(e.target.value as TipoDocumento | 'todos'); setPagina(1); }}
          className="h-10 rounded-md border border-input bg-card px-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25">
          <option value="todos">Todos los tipos</option>
          {(Object.keys(TIPO_LABEL) as TipoDocumento[]).map((k) => (<option key={`dop-${k}`} value={k}>{TIPO_LABEL[k]}</option>))}
        </select>
        <div className="flex rounded-md border border-input bg-card p-0.5" role="group" aria-label="Filtro rápido">
          {([{ v: 'todos', l: 'Todos' }, { v: 'vencidos', l: 'Vencidos' }, { v: 'reenviados', l: 'Reenviados' }] as const).map((o) => (
            <button key={`quick-${o.v}`} type="button" onClick={() => { setSolo(o.v); setPagina(1); }}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                solo === o.v ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground hover:bg-muted'
              }`}>{o.l}</button>
          ))}
        </div>
        <div className="relative ml-auto">
          <button type="button" onClick={() => setMenuCols((v) => !v)} aria-expanded={menuCols}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95">
            <Columns3 className="h-4 w-4" /> Columnas
            <span className="rounded bg-muted px-1.5 text-xs font-semibold tabular text-muted-foreground">{colsVisibles.length}/{COLUMNAS.length}</span>
          </button>
          {menuCols && (
            <>
              <button type="button" aria-label="Cerrar menú de columnas" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuCols(false)} />
              <div className="modal-in absolute right-0 z-40 mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-xl">
                <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Columnas visibles</p>
                {COLUMNAS.map((c) => (
                  <label key={`dcol-${c.key}`} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-muted">
                    <input type="checkbox" checked={colsVisibles.includes(c.key)}
                      onChange={() => setColsVisibles((cv) => (cv.includes(c.key) ? cv.filter((k) => k !== c.key) : [...cv, c.key]))}
                      className="h-4 w-4 rounded border-input accent-primary" />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {cargando ? (
        <TableSkeleton rows={6} cols={8} />
      ) : !esMiCargo ? (
        <EmptyState icon={<Info className="h-6 w-6" />} title={`La cola de ${CARGOS_DESPACHO.find((c) => c.value === cargo)?.label} es de solo lectura`}
          description="Cambia a tu cargo (Inspector General) para aprobar, observar o rechazar los documentos que están en tu paso actual."
          actionLabel="Volver a Inspector General" onAction={() => setCargo('inspector_general')} />
      ) : visibles.length === 0 ? (
        base.length === 0 ? (
          <EmptyState icon={<PartyPopper className="h-6 w-6" />} title="Despacho al día: no hay documentos pendientes"
            description="Cuando un tutor envíe un oficio, plan o acta a tu cargo, aparecerá aquí ordenado por tiempo de espera."
            actionLabel="Actualizar bandeja" onAction={refrescar} />
        ) : (
          <EmptyState icon={<Search className="h-6 w-6" />} title="Ningún documento coincide con el filtro"
            description="Prueba con otro N° de documento, otro emisor o quita el filtro rápido de vencidos."
            actionLabel="Quitar filtros" onAction={() => { setBusqueda(''); setTipo('todos'); setSolo('todos'); }} />
        )
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-[12px] uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" aria-label="Seleccionar todos" checked={todosMarcados}
                    onChange={() => setSeleccion((s) => todosMarcados ? s.filter((id) => !visibles.some((d) => d.id === id)) : Array.from(new Set([...s, ...visibles.map((d) => d.id)])))}
                    className="h-4 w-4 rounded border-input accent-primary" />
                </th>
                {mostrar('numero') && <th className="px-3 py-3"><SortHead k="numero">N° documento</SortHead></th>}
                {mostrar('asunto') && <th className="px-3 py-3 font-semibold">Asunto</th>}
                {mostrar('tipo') && <th className="px-3 py-3 font-semibold">Tipo</th>}
                {mostrar('estudiante') && <th className="px-3 py-3"><SortHead k="estudiante">Estudiante</SortHead></th>}
                {mostrar('curso') && <th className="px-3 py-3 font-semibold">Curso</th>}
                {mostrar('emisor') && <th className="px-3 py-3 font-semibold">Emisor</th>}
                {mostrar('ruta') && <th className="px-3 py-3 font-semibold">Ruta</th>}
                {mostrar('version') && <th className="px-3 py-3"><SortHead k="version">Versión</SortHead></th>}
                {mostrar('llegada') && <th className="px-3 py-3 font-semibold">Llegada</th>}
                {mostrar('espera') && <th className="px-3 py-3"><SortHead k="espera">Espera / SLA</SortHead></th>}
                <th className="px-4 py-3 text-right font-semibold">Decidir</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((d) => {
                const marcado = seleccion.includes(d.id);
                const sem = semaforo(d.horasEnDespacho);
                const pct = Math.min(100, Math.round((d.horasEnDespacho / 72) * 100));
                return (
                  <tr key={d.id} className={`group border-b border-border transition-all duration-200 even:bg-muted/20 hover:bg-primary/5 ${
                    marcado ? 'bg-primary/10 even:bg-primary/10' : ''
                  } ${saliendo.includes(d.id) ? 'row-exit' : ''}`}>
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" aria-label={`Seleccionar ${d.numero}`} checked={marcado}
                        onChange={() => setSeleccion((s) => (marcado ? s.filter((x) => x !== d.id) : [...s, d.id]))}
                        className="h-4 w-4 rounded border-input accent-primary" />
                    </td>
                    {mostrar('numero') && (
                      <td className="px-3 py-3 align-top">
                        <Link href="/detalle-del-documento" className="font-doc text-[13px] font-semibold text-primary hover:underline">{d.numero}</Link>
                      </td>
                    )}
                    {mostrar('asunto') && (
                      <td className="max-w-[280px] px-3 py-3 align-top">
                        <p className="truncate font-medium text-foreground" title={d.asunto}>{d.asunto}</p>
                        {d.devoluciones > 0 && <p className="mt-0.5 text-xs text-warning tabular">Reenviado tras {d.devoluciones} devolución{d.devoluciones > 1 ? 'es' : ''}</p>}
                      </td>
                    )}
                    {mostrar('tipo') && <td className="px-3 py-3 align-top"><TipoBadge tipo={d.tipo} /></td>}
                    {mostrar('estudiante') && <td className="px-3 py-3 align-top"><p className="max-w-[180px] truncate text-foreground" title={d.estudiante}>{d.estudiante}</p></td>}
                    {mostrar('curso') && <td className="whitespace-nowrap px-3 py-3 align-top text-foreground">{d.curso}</td>}
                    {mostrar('emisor') && <td className="px-3 py-3 align-top"><p className="max-w-[160px] truncate text-foreground" title={d.emisor}>{d.emisor}</p></td>}
                    {mostrar('ruta') && (
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Paso: {CARGO_CORTO[d.cargoActual]}</p>
                          <RouteMini ruta={d.ruta} />
                        </div>
                      </td>
                    )}
                    {mostrar('version') && <td className="px-3 py-3 align-top"><VersionChip version={d.version} /></td>}
                    {mostrar('llegada') && <td className="whitespace-nowrap px-3 py-3 align-top font-doc text-xs text-muted-foreground">{d.llegada}</td>}
                    {mostrar('espera') && (
                      <td className="min-w-[150px] px-3 py-3 align-top">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-bold tabular ${TONO_TXT[sem.tono]}`}>{formatHoras(d.horasEnDespacho)}</span>
                          <span className={`text-xs font-semibold ${TONO_TXT[sem.tono]}`}>{sem.texto}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${TONO_BAR[sem.tono]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip label="Ver documento y recorrido">
                          <Link href="/detalle-del-documento" className="rounded-md p-1.5 text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95" aria-label={`Ver ${d.numero}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Tooltip>
                        <Tooltip label="Aprobar paso">
                          <button type="button" onClick={() => setAccion({ tipo: 'aprobar', doc: d })} className="rounded-md p-1.5 text-success transition-all duration-150 hover:bg-success/10 active:scale-95" aria-label={`Aprobar ${d.numero}`}>
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip label="Devolver con observación">
                          <button type="button" onClick={() => setAccion({ tipo: 'observar', doc: d })} className="rounded-md p-1.5 text-warning transition-all duration-150 hover:bg-warning/10 active:scale-95" aria-label={`Observar ${d.numero}`}>
                            <MessageSquareWarning className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip label="Rechazar y cerrar trámite">
                          <button type="button" onClick={() => setAccion({ tipo: 'rechazar', doc: d })} className="rounded-md p-1.5 text-destructive transition-all duration-150 hover:bg-destructive/10 active:scale-95" aria-label={`Rechazar ${d.numero}`}>
                            <Ban className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!cargando && esMiCargo && filtrados.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Mostrando <span className="font-semibold text-foreground tabular">{(paginaActual - 1) * porPagina + 1}–{Math.min(paginaActual * porPagina, filtrados.length)}</span>{' '}
            de <span className="font-semibold text-foreground tabular">{filtrados.length}</span> pendientes
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-muted-foreground">
              Filas
              <select value={porPagina} onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1); }}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25">
                {[5, 8, 12].map((n) => (<option key={`dpp-${n}`} value={n}>{n}</option>))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button type="button" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}
                className="rounded-md border border-input p-2 text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                <button key={`dpage-${n}`} type="button" onClick={() => setPagina(n)}
                  className={`h-9 min-w-9 rounded-md px-2 text-sm font-semibold tabular transition-all duration-150 active:scale-95 ${
                    n === paginaActual ? 'bg-primary text-primary-foreground' : 'text-secondary-foreground hover:bg-muted'
                  }`}>{n}</button>
              ))}
              <button type="button" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}
                className="rounded-md border border-input p-2 text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Página siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {seleccion.length > 0 && (
        <div className="slide-bar sticky bottom-4 z-30 mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-3 text-background shadow-2xl">
          <p className="text-sm font-semibold"><span className="tabular">{seleccion.length}</span> documento{seleccion.length > 1 ? 's' : ''} seleccionado{seleccion.length > 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={aprobarMasivo} className="inline-flex items-center gap-2 rounded-md bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground transition-all duration-150 hover:bg-success/90 active:scale-95">
              <CheckCircle2 className="h-4 w-4" /> Aprobar seleccionados
            </button>
            <button type="button" onClick={() => setSeleccion([])} className="rounded-md p-1.5 text-background transition-all duration-150 hover:bg-background/15 active:scale-95" aria-label="Limpiar selección">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <DespachoActionModals accion={accion?.tipo ?? null} documento={accion?.doc ?? null} onClose={() => setAccion(null)} onConfirm={confirmar} />
    </section>
  );
}

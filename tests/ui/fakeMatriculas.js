// Mini base de datos en memoria SOLO para matrículas y estudiantes, con la misma restricción única de la real (estudiante + período).
export const db = { matriculas: [], estudiantes: [] };
let n = 0;
class Q {
  constructor(t) { this.t = t; this.op = 'select'; this.p = null; this.f = []; this.uno = false; this.lista = false; }
  _(op, p) { const q = new Q(this.t); Object.assign(q, { op, p, f: [...this.f], uno: this.uno, lista: true }); return q; }
  select() { return this.op === 'select' ? this._('select') : Object.assign(this._(this.op, this.p), {}); }
  insert(p) { return this._('insert', p); } update(p) { return this._('update', p); }
  eq(c, v) { this.f.push([c, v]); return this; } order() { return this; } limit() { return this; } in() { return this; }
  single() { this.uno = true; return this; }
  then(res) {
    const filas = db[this.t].filter(r => this.f.every(([c, v]) => r[c] === v));
    if (this.op === 'insert') {
      const dup = db[this.t].some(r => this.t === 'matriculas' && r.estudiante_id === this.p.estudiante_id && r.periodo_id === this.p.periodo_id);
      if (dup) return res({ data: null, error: { message: 'duplicate key value violates unique constraint "matriculas_estudiante_id_periodo_id_key"' } });
      const fila = { id: 'm' + (++n), ...this.p }; db[this.t].push(fila); return res({ data: this.uno ? fila : [fila], error: null });
    }
    if (this.op === 'update') { filas.forEach(r => Object.assign(r, this.p)); return res({ data: this.uno ? (filas[0] ?? null) : filas, error: null }); }
    return res({ data: this.uno ? (filas[0] ?? null) : filas, error: null });
  }
}
export const supabase = { from: t => { const q = new Q(t); q.then = undefined; return q; }, auth: { getSession: async () => ({}), refreshSession: async () => ({}) }, functions: { invoke: async () => ({}) }, rpc: async () => ({}) };
export const ROLE_GROUP = {}; export const ROLE_LABELS = {};

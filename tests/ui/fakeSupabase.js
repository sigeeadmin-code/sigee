// Supabase de mentira para probar pantallas. Imita lo importante del cliente real:
//  - supabase.from('tabla') devuelve un constructor que NO es "esperable" (await sin .insert/.select devuelve el propio constructor, igual que el real)
//  - después de .select/.insert/.update/... sí es esperable y devuelve { data, error }
export const llamadas = [];
export const base = { estudiantes: [], representantes: [], matriculas: [], grados: [], paralelos: [], periodos_lectivos: [], instituciones: [] };
export let falla = null;                       // { tabla, op, mensaje } para simular un error de la base
export const setFalla = f => { falla = f; };
export const reiniciar = () => { llamadas.length = 0; falla = null; let n = 1; globalThis.__id = () => 'id' + (n++); };
reiniciar();

class Q {
  constructor(tabla) { this.t = tabla; this.op = 'select'; this.payload = null; this.unico = false; this.thenable = false; }
  _c(op, payload) { const q = new Q(this.t); q.op = op; q.payload = payload ?? this.payload; q.unico = this.unico; q.thenable = true; return q; }
  select() { const q = this.op === 'select' ? this._c('select') : this._c(this.op, this.payload); return q; }
  insert(p) { return this._c('insert', p); }
  update(p) { return this._c('update', p); }
  delete() { return this._c('delete'); }
  upsert(p) { return this._c('upsert', p); }
  eq() { return this; } in() { return this; } is() { return this; } not() { return this; } order() { return this; } limit() { return this; } range() { return this; }
  single() { const q = this._c(this.op, this.payload); q.unico = true; return q; }
  maybeSingle() { return this.single(); }
  then(res, rej) {
    if (!this.thenable) return res(this);       // (no se usa: el constructor raíz no es esperable, ver from())
    llamadas.push({ tabla: this.t, op: this.op, payload: this.payload });
    if (falla && falla.tabla === this.t && falla.op === this.op) return res({ data: null, error: { message: falla.mensaje } });
    let data;
    if (this.op === 'insert') {
      const filas = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(p => ({ id: globalThis.__id(), ...p }));
      base[this.t] = [...(base[this.t] || []), ...filas];
      data = this.unico ? filas[0] : filas;
    } else if (this.op === 'select') {
      data = this.unico ? (base[this.t] || [])[0] ?? null : (base[this.t] || []);
    } else data = this.unico ? {} : [];
    return res({ data, error: null });
  }
}
export const supabase = {
  from(tabla) { const raiz = new Q(tabla); raiz.then = undefined; return raiz; },      // raíz NO esperable, como en el cliente real
  auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }), refreshSession: async () => ({ data: { session: { access_token: 't2' } }, error: null }), signOut: async () => ({}) },
  functions: { invoke: async () => ({ data: {}, error: null }) },
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
};
export const ROLE_GROUP = {}; export const ROLE_LABELS = {};

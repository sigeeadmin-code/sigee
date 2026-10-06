import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import path from 'node:path';
const raiz = path.resolve(process.argv[2] || '.');
const out = path.join(raiz, 'tests/ui/.salida.cjs');
await build({
  entryPoints: [path.join(raiz, 'tests/ui/estudiantes.ui.jsx')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'error',
  loader: { '.js': 'jsx', '.jsx': 'jsx' }, jsx: 'automatic', external: ['jsdom'],
  define: { 'import.meta.env': '{}' },
  plugins: [{
    name: 'alias', setup(b) {
      b.onResolve({ filter: /^\.{1,2}\/(.*\/)?supabase\.js$/ }, () => ({ path: path.join(raiz, 'tests/ui/fakeSupabase.js') }));
      b.onResolve({ filter: /^\.{1,2}\/(.*\/)?SessionContext\.jsx$/ }, () => ({ path: path.join(raiz, 'tests/ui/sessionStub.js') }));
    }
  }]
});
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) Object.defineProperty(globalThis, k, { value: dom.window[k] ?? dom.window, configurable: true, writable: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.confirm = () => true; dom.window.confirm = () => true; dom.window.alert = () => {};
await import('file://' + out);
await globalThis.__correr();
for (const r of globalThis.__resultados) console.log('RESULTADO ' + JSON.stringify(r));
process.exit(0);

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cada compilación lleva un identificador. Se incrusta en la aplicación y se publica en /version.json:
// así una pestaña que quedó abierta con una versión vieja se entera sola de que hay una nueva.
const ID_VERSION = String(Date.now());

export default defineConfig({
  define: { __ID_VERSION__: JSON.stringify(ID_VERSION) },
  plugins: [
    react(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: ID_VERSION }) });
      }
    }
  ]
});

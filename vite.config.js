import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cada compilación lleva un identificador. Se incrusta en la aplicación y se publica en /version.json:
// así una pestaña que quedó abierta con una versión vieja se entera sola de que hay una nueva.
const ID_VERSION = String(Date.now());

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Librerías pesadas en archivos aparte: se cachean y no se vuelven a bajar en cada despliegue.
        manualChunks: {
          vendor_react: ['react', 'react-dom', 'react-router-dom'],
          vendor_supabase: ['@supabase/supabase-js'],
          vendor_graficos: ['recharts'],
          vendor_excel: ['xlsx']
        }
      }
    }
  },
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

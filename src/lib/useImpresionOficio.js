import { useEffect, useState } from 'react';
import { usarMargenesA4 } from './impresion.js';

/**
 * Impresión de hojas de oficio con el mecanismo del sistema (body.imprimiendo-oficio + márgenes @page).
 * Uso: const { modo, imprimir } = useImpresionOficio(); imprimir('entrega' | 'recorrido');
 * y renderizar <OficioImpresion modo={modo} …/> mientras `modo` tenga valor (la hoja se monta en <body>).
 */
export function useImpresionOficio() {
  const [modo, setModo] = useState(null);
  useEffect(() => {
    if (!modo) return undefined;
    document.body.classList.add('imprimiendo-oficio');
    const quitarMargenes = usarMargenesA4();
    const fin = () => { document.body.classList.remove('imprimiendo-oficio'); quitarMargenes(); setModo(null); };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 250);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); document.body.classList.remove('imprimiendo-oficio'); quitarMargenes(); };
  }, [modo]);
  return { modo, imprimir: setModo };
}

import { useEffect, useState } from 'react';

/**
 * Impresión de hojas de oficio con el mecanismo del sistema (body.imprimiendo-oficio + @page).
 * Uso: const { modo, imprimir } = useImpresionOficio(); … imprimir('entrega') y renderizar <OficioImpresion modo={modo} /> si modo.
 */
export function useImpresionOficio() {
  const [modo, setModo] = useState(null);
  useEffect(() => {
    if (!modo) return undefined;
    document.body.classList.add('imprimiendo-oficio');
    const fin = () => { document.body.classList.remove('imprimiendo-oficio'); setModo(null); };
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 200);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fin); document.body.classList.remove('imprimiendo-oficio'); };
  }, [modo]);
  return { modo, imprimir: setModo };
}

// Avisos en vivo (Supabase Realtime): una sola conexión por usuario escucha notificaciones y justificaciones de SU plantel.
// Las reglas de seguridad de la base (RLS) también filtran lo que llega: una cuenta solo recibe lo que tiene permiso de ver.
// Es una mejora opcional: si falla o se desactiva, SIGEE sigue funcionando igual (solo hay que recargar para ver lo nuevo).
// Para cuidar el límite de conexiones del plan, se cierra la conexión cuando la pestaña lleva un rato oculta.
export function textoAviso(tabla, evento, nuevo) {
  if (tabla === 'notificaciones') {
    if (evento !== 'INSERT') return null;
    const prefijo = nuevo && nuevo.prioridad === 'urgente' ? 'URGENTE' : nuevo && nuevo.prioridad === 'importante' ? 'Importante' : 'Nueva notificación';
    return `${prefijo}${nuevo && nuevo.titulo ? ': ' + nuevo.titulo : ''}`;
  }
  if (tabla === 'justificaciones') {
    if (evento === 'INSERT') return 'Llegó una nueva justificación';
    if (evento === 'UPDATE' && nuevo && nuevo.estado) return `Una justificación quedó como: ${nuevo.estado}`;
  }
  return null;
}

export function crearAvisosEnVivo(supabase, { institucionId, perfilId, alAviso, ocultoMs = 120000, doc = (typeof document !== 'undefined' ? document : null), setT = setTimeout, clearT = clearTimeout }) {
  let canal = null; let detenido = true; let timerOculto = null;
  const emitir = (tabla, p) => {
    try {
      const nuevo = p && p.new; const evento = p && p.eventType;
      if (nuevo && nuevo.created_by && perfilId && nuevo.created_by === perfilId) return;   // lo hizo esta misma persona
      const texto = textoAviso(tabla, evento, nuevo);
      if (texto && alAviso) alAviso({ tabla, evento, texto, registro: nuevo || null });
    } catch { /* un aviso nunca debe romper la pantalla */ }
  };
  const abrir = () => {
    if (canal || detenido || !institucionId) return;
    try {
      const filtro = `institucion_id=eq.${institucionId}`;
      canal = supabase.channel(`avisos-${institucionId}-${perfilId || 'x'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: filtro }, p => emitir('notificaciones', p))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'justificaciones', filter: filtro }, p => emitir('justificaciones', p))
        .subscribe();
    } catch { canal = null; }
  };
  const cerrar = () => { if (!canal) return; try { supabase.removeChannel(canal); } catch { /* ya cerrado */ } canal = null; };
  const alCambiarVisibilidad = () => {
    if (!doc) return;
    if (doc.hidden) { if (!timerOculto) timerOculto = setT(() => { timerOculto = null; cerrar(); }, ocultoMs); }
    else {
      if (timerOculto) { clearT(timerOculto); timerOculto = null; }
      const estabaCerrado = !canal; abrir();
      if (estabaCerrado && canal && alAviso) { try { alAviso({ tabla: '*', evento: 'RECONECTADO', texto: null, registro: null }); } catch { /* sin efecto */ } }   // por si algo llegó mientras no escuchábamos
    }
  };
  return {
    iniciar() { detenido = false; abrir(); if (doc) doc.addEventListener('visibilitychange', alCambiarVisibilidad); },
    detener() { detenido = true; if (timerOculto) { clearT(timerOculto); timerOculto = null; } if (doc) doc.removeEventListener('visibilitychange', alCambiarVisibilidad); cerrar(); },
    _estado() { return { abierto: !!canal }; }
  };
}

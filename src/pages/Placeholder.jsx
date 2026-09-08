import React from 'react';
export default function Placeholder({ title }) {
  return (
    <div>
      <h2>{title}</h2>
      <div className="card"><p className="muted">Este módulo está en construcción en esta vista previa. Su versión funcional actual sigue disponible en producción.</p></div>
    </div>
  );
}

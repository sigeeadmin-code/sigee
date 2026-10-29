'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, CheckCircle2, MessageSquareWarning, Ban } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { DespachoItem } from '@/lib/oficios-data';

export type AccionDespacho = 'aprobar' | 'observar' | 'rechazar';

interface Props {
  accion: AccionDespacho | null;
  documento: DespachoItem | null;
  onClose: () => void;
  onConfirm: (accion: AccionDespacho, doc: DespachoItem, motivo?: string) => void;
}

interface MotivoForm {
  motivo: string;
}

const TEXTOS: Record<AccionDespacho, { titulo: string; descripcion: string; boton: string }> = {
  aprobar: {
    titulo: 'Aprobar paso',
    descripcion: 'El documento avanzará al siguiente cargo de la ruta y se registrará tu firma en el historial.',
    boton: 'Aprobar paso',
  },
  observar: {
    titulo: 'Devolver con observación',
    descripcion: 'El documento vuelve al emisor para su corrección. El motivo es obligatorio y queda en el historial.',
    boton: 'Devolver al emisor',
  },
  rechazar: {
    titulo: 'Rechazar documento',
    descripcion: 'El trámite se cierra definitivamente. Indica el motivo para dejar constancia.',
    boton: 'Rechazar trámite',
  },
};

export default function DespachoActionModals({ accion, documento, onClose, onConfirm }: Props) {
  const [enviando, setEnviando] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MotivoForm>({ defaultValues: { motivo: '' } });

  const cerrar = () => { reset(); setEnviando(false); onClose(); };

  const ejecutar = (motivo?: string) => {
    if (!accion || !documento) return;
    setEnviando(true);
    // Claude: oficios_aprobar_paso | oficios_observar | oficios_rechazar
    setTimeout(() => { onConfirm(accion, documento, motivo); reset(); setEnviando(false); }, 600);
  };

  const requiereMotivo = accion === 'observar' || accion === 'rechazar';
  const textos = accion ? TEXTOS[accion] : null;

  return (
    <Modal open={accion !== null && documento !== null} onClose={cerrar} title={textos?.titulo ?? ''} description={textos?.descripcion} size="md">
      {documento && accion && (
        <form onSubmit={handleSubmit((v) => ejecutar(v.motivo))} className="space-y-4" noValidate>
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
            <p className="font-doc text-xs font-semibold text-primary">{documento.numero}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{documento.asunto}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{documento.estudiante} · {documento.curso} · versión {documento.version}</p>
          </div>

          {requiereMotivo ? (
            <div>
              <label htmlFor="motivo-despacho" className="mb-1 block text-sm font-semibold text-foreground">
                {accion === 'observar' ? 'Motivo de la observación' : 'Motivo del rechazo'}
              </label>
              <p className="mb-2 text-xs text-muted-foreground">Mínimo 15 caracteres. Sé específico para que el emisor sepa qué corregir.</p>
              <textarea
                id="motivo-despacho"
                rows={4}
                {...register('motivo', {
                  required: 'El motivo es obligatorio para continuar',
                  minLength: { value: 15, message: 'Describe el motivo con al menos 15 caracteres' },
                })}
                className={`w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-150 focus:outline-none focus:ring-2 ${
                  errors.motivo ? 'border-destructive focus:ring-destructive/25' : 'border-input focus:border-ring focus:ring-ring/25'
                }`}
                placeholder={accion === 'observar' ? 'Ej.: Falta adjuntar el promedio del primer parcial de Física.' : 'Ej.: El caso fue resuelto en mediación y el documento no procede.'}
              />
              {errors.motivo && <p className="mt-1 text-xs font-medium text-destructive">{errors.motivo.message}</p>}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg bg-success/10 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Tu acción quedará registrada con cargo, usuario y marca de tiempo. No se generará un PDF adicional.</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={cerrar} disabled={enviando} className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-secondary-foreground transition-all duration-150 hover:bg-muted active:scale-95 disabled:opacity-50">Cancelar</button>
            <button
              type="submit"
              disabled={enviando}
              className={`inline-flex min-w-[172px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-95 disabled:opacity-70 ${
                accion === 'aprobar' ? 'bg-success text-success-foreground hover:bg-success/90'
                  : accion === 'observar' ? 'bg-warning text-warning-foreground hover:bg-warning/90'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }`}
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : accion === 'aprobar' ? <CheckCircle2 className="h-4 w-4" /> : accion === 'observar' ? <MessageSquareWarning className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
              {enviando ? 'Registrando…' : textos?.boton}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

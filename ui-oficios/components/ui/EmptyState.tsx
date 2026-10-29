import React from 'react';

interface Props {
  icon?: React.ReactNode; title: string; description?: string; actionLabel?: string; onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-3 text-muted-foreground opacity-60">{icon}</div>}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="mt-4 rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

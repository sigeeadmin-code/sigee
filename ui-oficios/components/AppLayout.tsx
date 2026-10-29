import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Stub layout · Claude: en SIGEE Vite usar sidebar + topbar real */
export default function AppLayout({ title, subtitle, children }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}

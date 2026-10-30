'use client';

import React, { useState } from 'react';
import { Toaster } from 'sonner';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="print-hide contents">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-5 md:px-6 lg:px-8 xl:px-10 2xl:px-16">
          {children}
        </main>
      </div>
      <Toaster position="bottom-right" richColors closeButton duration={3000} />
    </div>
  );
}

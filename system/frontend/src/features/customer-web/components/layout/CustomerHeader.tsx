import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, User, Moon, Sun, LogOut } from 'lucide-react';
import { useCustomerSession } from '../../auth/CustomerSessionContext';
import type { CustomerAppRoute } from '../../types';

export function CustomerHeader({
  activeRoute,
  onNavigate,
}: {
  activeRoute: CustomerAppRoute;
  onNavigate: (route: CustomerAppRoute) => void;
}) {
  const { profile, isGuest, logout } = useCustomerSession();
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light') return false;
      return true; // Default dark
    }
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6 lg:px-8 text-foreground">
      {/* Brand Identity & Breadcrumbs (Like TicketX Admin Topbar) */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
          aria-label="TicketX Support Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <span className="text-muted-foreground hidden sm:inline">All Workspaces</span>
            <span className="text-muted-foreground hidden sm:inline">›</span>
            <span className="font-semibold text-foreground">TicketX Support Hub</span>
            {profile?.companyName && (
              <span className="hidden md:inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-normal">
                {profile.companyName}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Identity Context & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="สลับโหมดสี (Dark/Light)"
          title={isDarkMode ? "เปลี่ยนเป็นโหมดสว่าง (Light)" : "เปลี่ยนเป็นโหมดมืด (Dark)"}
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
        </button>

        {/* User Identity Pill */}
        {isGuest ? (
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">
              {profile?.name || 'ผู้มาเยือน (Guest)'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold truncate max-w-[140px] sm:max-w-[220px]">
              {profile?.name || 'คุณลูกค้า'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

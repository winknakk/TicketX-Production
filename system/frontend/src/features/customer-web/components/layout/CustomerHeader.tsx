import React from 'react';
import { Building2, ChevronRight, ShieldCheck, User, Moon, Sun, Settings } from 'lucide-react';
import { useCustomerSession } from '../../auth/CustomerSessionContext';
import { useTheme } from '../../../../theme/themeProvider';
import { getCustomerRouteLabel } from '../../navigation';
import type { CustomerAppRoute } from '../../types';

export function CustomerHeader({ activeRoute }: { activeRoute: CustomerAppRoute }) {
  const { profile, isGuest, setIsSettingsOpen } = useCustomerSession();
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6 lg:px-8 text-foreground">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1 font-medium text-foreground/80">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{profile?.companyName || 'TicketX Support Hub'}</span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <span className="truncate font-semibold text-foreground">{getCustomerRouteLabel(activeRoute)}</span>
      </nav>

      {/* Identity Context & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="การตั้งค่าและโปรไฟล์"
          title="การตั้งค่าและโปรไฟล์"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Theme Switcher Button */}
        <button
          type="button"
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
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 hover:bg-emerald-500/20 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300 transition-all cursor-pointer shadow-2xs group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="คลิกเพื่อดูโปรไฟล์และสลับโครงการ"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">
              {profile?.name || 'คุณลูกค้า'}
            </span>
            <Settings className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </header>
  );
}

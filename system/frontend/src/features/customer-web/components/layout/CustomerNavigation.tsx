import React from 'react';
import { MessageSquare, Ticket, HelpCircle, LogOut, User, PlusCircle, ShieldCheck } from 'lucide-react';
import type { CustomerAppRoute } from '../../types';
import { useCustomerSession } from '../../auth/CustomerSessionContext';

interface NavItem {
  id: CustomerAppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function CustomerSidebar({
  activeRoute,
  onNavigate,
  ticketCount,
}: {
  activeRoute: CustomerAppRoute;
  onNavigate: (route: CustomerAppRoute) => void;
  ticketCount?: number;
}) {
  const { profile, isGuest, logout } = useCustomerSession();

  const items: NavItem[] = [
    { id: 'home', label: 'แชทช่วยเหลือ (Chat)', icon: MessageSquare },
    { id: 'tickets', label: 'ตั๋วของฉัน (My Tickets)', icon: Ticket, badge: ticketCount },
    { id: 'help', label: 'ศูนย์ช่วยเหลือ (Help)', icon: HelpCircle },
  ];

  const displayName = profile?.name || (isGuest ? 'ผู้มาเยือน (Guest)' : 'คุณลูกค้า');
  const displayEmail = profile?.email || (isGuest ? 'โหมดทดลองใช้งาน' : 'customer.win@ticketx.local');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <nav
      className="hidden lg:flex w-64 flex-col border-r border-border bg-card/60 p-3.5 shrink-0 text-foreground select-none transition-colors"
      aria-label="Customer Navigation"
    >
      {/* Top Action: New Chat */}
      <div className="mb-3">
        <button
          onClick={() => onNavigate('home')}
          className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-muted shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center gap-2.5">
            <PlusCircle className="h-4 w-4 text-emerald-500" />
            <span>เริ่มบทสนทนาใหม่</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">⌘N</span>
        </button>
      </div>

      {/* Primary Nav Menu (TicketX Clean Style) */}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeRoute === item.id || (item.id === 'tickets' && activeRoute === 'ticket-detail');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white font-semibold shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-muted text-foreground'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Profile & Logout Bar */}
      <div className="mt-auto border-t border-border pt-3">
        <div className="flex items-center justify-between rounded-xl bg-background p-2.5 border border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-primary font-bold text-xs text-white shadow-xs">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{displayEmail}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            title="ออกจากระบบ (Log out)"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

export function CustomerBottomNav({
  activeRoute,
  onNavigate,
  ticketCount,
}: {
  activeRoute: CustomerAppRoute;
  onNavigate: (route: CustomerAppRoute) => void;
  ticketCount?: number;
}) {
  const { logout } = useCustomerSession();

  const items: NavItem[] = [
    { id: 'home', label: 'แชท', icon: MessageSquare },
    { id: 'tickets', label: 'ตั๋วของฉัน', icon: Ticket, badge: ticketCount },
    { id: 'help', label: 'ช่วยเหลือ', icon: HelpCircle },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-zinc-800 bg-[#09090b]/95 backdrop-blur-md lg:hidden"
      aria-label="Mobile Navigation"
    >
      <div className="grid h-full w-full grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeRoute === item.id || (item.id === 'tickets' && activeRoute === 'ticket-detail');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive ? 'text-primary font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}

        {/* Mobile Logout */}
        <button
          onClick={logout}
          className="flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-rose-400 transition-colors"
          title="ออกจากระบบ"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[11px] font-medium">ออกระบบ</span>
        </button>
      </div>
    </nav>
  );
}

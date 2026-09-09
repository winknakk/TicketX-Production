import React from 'react';
import { LogOut, PlusCircle } from 'lucide-react';
import type { CustomerAppRoute } from '../../types';
import { customerNavigation } from '../../navigation';
import { useCustomerSession } from '../../auth/CustomerSessionContext';
import {
  SidebarBrand,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarNavItem,
} from '../../../../components/layout/AppShell';

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

  const items: NavItem[] = customerNavigation.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    badge: item.id === 'tickets' ? ticketCount : undefined,
  }));

  const displayName = profile?.name || (isGuest ? 'ผู้มาเยือน (Guest)' : 'คุณลูกค้า');
  const displayEmail = profile?.email || (isGuest ? 'โหมดทดลองใช้งาน' : 'customer.win@ticketx.local');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <nav
      className="hidden w-56 shrink-0 select-none flex-col border-r border-border bg-sidebar p-3 text-sidebar-foreground transition-colors lg:flex"
      aria-label="Customer Navigation"
    >
      <div className="mb-6 flex h-10 items-center">
        <SidebarBrand subtitle="Support Hub" onClick={() => onNavigate('home')} />
      </div>

      {/* Top Action: New Chat */}
      <button
        onClick={() => onNavigate('home')}
        className="touch-target mb-5 flex w-full items-center justify-between gap-2.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex items-center gap-2.5">
          <PlusCircle className="h-4 w-4 text-primary" />
          <span>เริ่มบทสนทนาใหม่</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">⌘N</span>
      </button>

      <div className="min-h-0 flex-1">
        <SidebarGroupLabel>ช่วยเหลือ</SidebarGroupLabel>
        <div className="space-y-1">
          {items.map((item) => (
            <SidebarNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              active={
                activeRoute === item.id || (item.id === 'tickets' && activeRoute === 'ticket-detail')
              }
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </div>

      <SidebarFooter
        initials={initial}
        name={displayName}
        detail={displayEmail}
        onLogout={logout}
        logoutLabel="ออกจากระบบ"
      />
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

  const items: NavItem[] = customerNavigation.map((item) => ({
    id: item.id,
    label: item.shortLabel,
    icon: item.icon,
    badge: item.id === 'tickets' ? ticketCount : undefined,
  }));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
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
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
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
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
          title="ออกจากระบบ"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[11px] font-medium">ออกระบบ</span>
        </button>
      </div>
    </nav>
  );
}

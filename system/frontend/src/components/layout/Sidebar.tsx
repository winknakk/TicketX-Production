import { ChevronsLeft, LogOut, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { appNavigation, type AppTab } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/Primitives';
// @ts-ignore
import TicketXLogo from '../../features/landing-hub/components/TicketXLogo';
import { useProject } from '../../context/ProjectContext';
import { getOperatorProfile } from '../../lib/operator';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function NavigationItems({
  activeTab,
  setActiveTab,
  expanded,
  onSelect,
}: Pick<SidebarProps, 'activeTab' | 'setActiveTab'> & { expanded: boolean; onSelect?: () => void }) {
  const userRole = localStorage.getItem('user_role') || 'super_admin';

  const allowedTabsByRole: Record<string, string[]> = {
    customer: ['portal'],
    employee: ['dashboard', 'conversations', 'tickets', 'directory'],
    admin: ['dashboard', 'conversations', 'tickets', 'directory', 'analytics', 'sla-center', 'plane-integrations', 'settings'],
    super_admin: ['dashboard', 'conversations', 'tickets', 'directory', 'center-iam', 'master-data', 'traces', 'automation-flows', 'prompt-sessions', 'handoff-audit', 'analytics', 'sla-center', 'plane-integrations', 'settings']
  };

  const allowedTabs = allowedTabsByRole[userRole] || allowedTabsByRole.super_admin;
  const filteredNav = appNavigation.filter((item) => allowedTabs.includes(item.id));
  const groups = [...new Set(filteredNav.map((item) => item.group))];

  return (
    <nav
      aria-label="Primary navigation"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {groups.map((group) => (
        <div key={group}>
          {expanded && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group}
            </p>
          )}
          <div className="space-y-1">
            {filteredNav
              .filter((item) => item.group === group)
              .map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {
                      setActiveTab(item.id);
                      onSelect?.();
                    }}
                    className={cn(
                      'touch-target relative flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                      expanded ? 'w-full gap-3 px-3.5 py-2.5' : 'h-10 w-10 mx-auto justify-center p-0',
                      active
                        ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-black dark:hover:text-white'
                    )}
                    title={expanded ? undefined : item.label}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {expanded && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ activeTab, setActiveTab, mobileOpen, onMobileClose }: SidebarProps) {
  const { activeProjectId } = useProject();
  const operatorProfile = getOperatorProfile(activeProjectId);
  const [pinned, setPinned] = useState(true);
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onMobileClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  const handleLogoClick = () => {
    setActiveTab('dashboard');
    window.location.hash = '#dashboard';
  };

  const handleLogout = () => {
    localStorage.removeItem('active_workspace_tab');
    window.location.hash = '#login';
  };

  return (
    <>
      <div
        className={cn('hidden shrink-0 transition-[width] duration-200 lg:block', pinned ? 'w-56' : 'w-16')}
        aria-hidden="true"
      />
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-sidebar p-3 text-sidebar-foreground transition-[width,box-shadow] duration-200 lg:flex',
          expanded ? 'w-56' : 'w-16',
          !pinned && hovered && 'shadow-xl'
        )}
      >
        {/* Header with Logo and Collapse icon (ChevronsLeft) */}
        <div className={cn('mb-6 flex h-10 items-center', expanded ? 'justify-between' : 'justify-center')}>
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex min-w-0 items-center gap-2.5 outline-none hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black text-white">
              <TicketXLogo size={18} fill="#ffffff" />
            </div>
            {expanded && (
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">TicketX</p>
                <p className="truncate text-[11px] text-muted-foreground font-medium">AI Support Hub</p>
              </div>
            )}
          </button>
          {expanded && (
            <IconButton
              label={pinned ? 'Collapse navigation' : 'Keep navigation expanded'}
              onClick={() => setPinned((value) => !value)}
              className="h-8 w-8 border-transparent bg-transparent hover:bg-sidebar-accent"
            >
              <ChevronsLeft
                className={cn('h-4 w-4 text-muted-foreground hover:text-sidebar-foreground transition-transform duration-200', !pinned && 'rotate-180')}
              />
            </IconButton>
          )}
        </div>

        {/* Navigation Items */}
        <NavigationItems activeTab={activeTab} setActiveTab={setActiveTab} expanded={expanded} />

        {/* Footer with Operator Profile & Logout Button */}
        <div className="mt-auto border-t border-border pt-3">
          {expanded ? (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
                  {operatorProfile.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-sidebar-foreground">{operatorProfile.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{operatorProfile.phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                title={`${operatorProfile.name} (${operatorProfile.phone})`}
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                {operatorProfile.initials}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-50 bg-slate-950/55 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[60] flex w-[min(18rem,88vw)] flex-col border-r border-border bg-sidebar p-4 text-sidebar-foreground shadow-2xl transition-transform lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen ? true : undefined}
      >
        <div className="mb-7 flex h-11 items-center justify-between">
          <button type="button" onClick={() => { handleLogoClick(); onMobileClose(); }} className="flex items-center gap-2.5 cursor-pointer">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-black text-white">
              <TicketXLogo size={18} fill="#ffffff" />
            </div>
            <div>
              <p className="text-sm font-semibold text-black">TicketX</p>
              <p className="text-[11px] text-slate-400">AI Support Hub</p>
            </div>
          </button>
          <IconButton label="Close navigation" onClick={onMobileClose} className="border-transparent bg-transparent">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <NavigationItems activeTab={activeTab} setActiveTab={setActiveTab} expanded onSelect={onMobileClose} />
        <div className="mt-auto border-t border-slate-100 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
              {operatorProfile.initials}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">{operatorProfile.name}</p>
              <p className="text-[11px] text-slate-400">{operatorProfile.phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

import { ChevronsLeft, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { appNavigation, type AppTab } from '../../lib/navigation';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/Primitives';
import { SidebarBrand, SidebarFooter, SidebarGroupLabel, SidebarNavItem } from './AppShell';
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
          {expanded && <SidebarGroupLabel>{group}</SidebarGroupLabel>}
          <div className="space-y-1">
            {filteredNav
              .filter((item) => item.group === group)
              .map((item) => (
                <SidebarNavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={activeTab === item.id}
                  expanded={expanded}
                  onClick={() => {
                    setActiveTab(item.id);
                    onSelect?.();
                  }}
                />
              ))}
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
          <SidebarBrand subtitle="AI Support Hub" expanded={expanded} onClick={handleLogoClick} />
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

        <SidebarFooter
          initials={operatorProfile.initials}
          name={operatorProfile.name}
          detail={operatorProfile.phone}
          expanded={expanded}
          onLogout={handleLogout}
        />
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
          <SidebarBrand
            subtitle="AI Support Hub"
            onClick={() => {
              handleLogoClick();
              onMobileClose();
            }}
          />
          <IconButton label="Close navigation" onClick={onMobileClose} className="border-transparent bg-transparent">
            <X className="h-5 w-5" />
          </IconButton>
        </div>
        <NavigationItems activeTab={activeTab} setActiveTab={setActiveTab} expanded onSelect={onMobileClose} />
        <SidebarFooter
          initials={operatorProfile.initials}
          name={operatorProfile.name}
          detail={operatorProfile.phone}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}

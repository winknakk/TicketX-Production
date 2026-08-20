import { Bell, Menu, MessageSquare, Moon, Search, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getTabLabel, type AppTab } from '../../lib/navigation';
import { useTheme } from '../../theme/themeProvider';
import { cn } from '../../lib/utils';
import { ProjectSelector } from '../conversations/ProjectSelector';
import { OrganizationSelector } from '../common/OrganizationSelector';
import { IconButton, StatusBadge } from '../ui/Primitives';
import { HandoffStatusBadge } from '../common/HandoffStatusBadge';
import { Breadcrumb } from '../common/Breadcrumb';
import { useProject } from '../../context/ProjectContext';
import { getOperatorProfile } from '../../lib/operator';

interface TopbarProps {
  title: AppTab;
  backendHealthy: boolean | null;
  conversations?: any[];
  onSelectNotification?: (conversationId: string) => void;
  onOpenNavigation: () => void;
}

export function Topbar({ title, backendHealthy, conversations = [], onSelectNotification, onOpenNavigation }: TopbarProps) {
  const { activeProjectId } = useProject();
  const operatorProfile = getOperatorProfile(activeProjectId);
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && dropdownRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
      if (event instanceof KeyboardEvent) notificationButtonRef.current?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [isOpen]);

  const notifications = conversations
    .filter((conversation) => conversation.handled_by === 'human' || ['PENDING_HUMAN', 'ACTIVE_HUMAN'].includes(conversation.takeover_status))
    .map((conversation) => ({
      id: conversation.id,
      channel: conversation.channel || 'Unknown channel',
      customerName: conversation.profile_name || conversation.customer || 'Unknown customer',
      lastMessage: conversation.last_message || 'No message preview available',
      timestamp: conversation.last_message_timestamp,
      waiting: conversation.takeover_status !== 'ACTIVE_HUMAN',
      owner: conversation.assigned_pm,
    }))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  const waitingCount = notifications.filter((notification) => notification.waiting).length;

  const userRole = localStorage.getItem('user_role') || 'super_admin';
  const isCustomer = userRole === 'customer';

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/92 px-3 backdrop-blur-md sm:px-5 lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton label="Open navigation" onClick={onOpenNavigation} className="lg:hidden"><Menu className="h-5 w-5" /></IconButton>
        <Breadcrumb activeTab={title} />
        <span className={`hidden items-center gap-1.5 text-[11px] font-medium md:inline-flex ${backendHealthy === false ? 'text-destructive' : 'text-muted-foreground'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${backendHealthy === null ? 'bg-muted-foreground' : backendHealthy ? 'bg-success' : 'bg-destructive'}`} />
          {backendHealthy === null ? 'Checking API' : backendHealthy ? 'API available' : 'API unavailable'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {!isCustomer && (
          <>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-command-palette'))}
              className="hidden md:inline-flex items-center gap-2 h-9 px-3 text-xs text-muted-foreground bg-muted/50 border border-border/80 rounded-lg hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
              <kbd className="font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <div className="hidden sm:block"><ProjectSelector /></div>
            <div className="hidden sm:block"><OrganizationSelector /></div>
          </>
        )}
        <span className="hidden lg:inline-flex px-2.5 py-1 rounded-md bg-muted text-foreground border border-border text-xs font-bold uppercase tracking-wider">
          {userRole}
        </span>
        <IconButton label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>{theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</IconButton>
        {!isCustomer && (
          <div className="relative" ref={dropdownRef}>
            <button ref={notificationButtonRef} type="button" aria-label={`Human handoff queue${waitingCount ? `, ${waitingCount} waiting` : ''}`} aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen((value) => !value)} className={cn('touch-target relative grid w-11 place-items-center rounded-md border border-transparent bg-transparent hover:bg-muted', isOpen && 'bg-muted')}>
              <Bell className="h-4 w-4" />
              {waitingCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-escalated px-1 text-[10px] font-bold text-white">{waitingCount}</span>}
            </button>
            {isOpen && (
              <div role="dialog" aria-label="Human handoff queue" className="fixed inset-x-3 top-[4.5rem] max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
                <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-bold">Human handoff queue</h2><p className="text-xs text-muted-foreground">Operational ownership requests</p></div>{waitingCount > 0 && <StatusBadge tone="escalated">{waitingCount} waiting</StatusBadge>}</div>
                <div className="max-h-[min(28rem,calc(100dvh-11rem))] overflow-y-auto">
                  {notifications.length === 0 ? <div className="p-8 text-center"><Bell className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">No active handoffs</p><p className="mt-1 text-xs text-muted-foreground">Requests will appear here when reported by the API.</p></div> : notifications.map((notification) => (
                    <button key={notification.id} type="button" onClick={() => { onSelectNotification?.(notification.id); setIsOpen(false); }} className="flex min-h-20 w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/60">
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><MessageSquare className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold">{notification.customerName}</span><HandoffStatusBadge status={notification.waiting ? 'PENDING_HUMAN' : 'CLAIMED'} label={notification.waiting ? 'Waiting' : notification.owner ? `Claimed · ${notification.owner}` : 'Claimed'} /></div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.lastMessage}</p><p className="mt-1 text-[11px] text-muted-foreground">{notification.channel}{notification.timestamp ? ` · ${new Date(notification.timestamp).toLocaleString()}` : ''}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

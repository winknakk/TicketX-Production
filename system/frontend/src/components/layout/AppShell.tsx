import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
// @ts-ignore — TicketXLogo is an untyped .jsx module
import TicketXLogo from '../../features/landing-hub/components/TicketXLogo';

/**
 * Sidebar building blocks shared by the operator workspace (`Sidebar.tsx`) and
 * the customer portal (`CustomerNavigation.tsx`).
 *
 * Only the *visual vocabulary* lives here — brand block, group label, nav item,
 * footer. Each sidebar keeps its own data (role-filtered navigation vs. customer
 * session) and its own mobile strategy (slide-in drawer vs. bottom bar), because
 * those are genuine product differences, not inconsistencies.
 *
 * Every value below is the one the admin sidebar already shipped, so adopting
 * these components is a no-op for admin and an alignment for the portal.
 */

/** 32px logo tile + wordmark. `subtitle` distinguishes the two surfaces. */
export function SidebarBrand({
  subtitle,
  expanded = true,
  onClick,
  className,
}: {
  subtitle: string;
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
        <TicketXLogo size={18} fill="currentColor" />
      </div>
      {expanded && (
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">TicketX</p>
          <p className="truncate text-[11px] font-medium text-muted-foreground">{subtitle}</p>
        </div>
      )}
    </>
  );

  if (!onClick) {
    return <div className={cn('flex min-w-0 items-center gap-2.5', className)}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-2.5 outline-none transition-opacity hover:opacity-80',
        className,
      )}
    >
      {content}
    </button>
  );
}

/** Uppercase section heading above a run of nav items. */
export function SidebarGroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * One navigation row. `expanded={false}` renders the icon-only square the admin
 * sidebar uses when collapsed.
 */
export function SidebarNavItem({
  icon: Icon,
  label,
  active,
  expanded = true,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  expanded?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : label}
      className={cn(
        'touch-target relative flex items-center rounded-xl text-sm font-medium transition-all duration-150',
        expanded ? 'w-full gap-3 px-3.5 py-2.5' : 'mx-auto h-10 w-10 justify-center p-0',
        active
          ? 'bg-slate-900 font-semibold text-white shadow-sm dark:bg-slate-800 dark:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-black dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {expanded && <span className="flex-1 truncate text-left">{label}</span>}
      {expanded && badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
            active ? 'bg-white/20 text-white' : 'bg-muted text-foreground',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** Avatar + identity + logout, pinned to the bottom of a sidebar. */
export function SidebarFooter({
  initials,
  name,
  detail,
  expanded = true,
  onLogout,
  logoutLabel = 'Logout',
}: {
  initials: string;
  name: string;
  detail?: string;
  expanded?: boolean;
  onLogout: () => void;
  logoutLabel?: string;
}) {
  const avatar = (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
      {initials}
    </div>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={onLogout}
      title={logoutLabel}
      aria-label={logoutLabel}
      className="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );

  return (
    <div className="mt-auto border-t border-border pt-3">
      {expanded ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            {avatar}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{name}</p>
              {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
            </div>
          </div>
          {logoutButton}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-1">
          <div title={detail ? `${name} (${detail})` : name}>{avatar}</div>
          {logoutButton}
        </div>
      )}
    </div>
  );
}

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Bot, CheckCircle2, Clock3, Info, LoaderCircle, RefreshCw, Search, TriangleAlert, UserRoundCheck, WifiOff, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ className, variant = 'primary', children, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={cn(
        'touch-target inline-flex items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'secondary' && 'border border-border bg-transparent text-foreground hover:bg-muted',
        variant === 'ghost' && 'text-foreground hover:bg-muted',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn('touch-target inline-flex items-center justify-center rounded-md border border-transparent bg-transparent text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs font-semibold text-primary">{eyebrow}</p>}
        <h1 className="text-balance text-2xl font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type StatusTone = 'neutral' | 'information' | 'ai' | 'human' | 'pending' | 'claimed' | 'escalated' | 'resolved' | 'success' | 'warning' | 'error' | 'stale' | 'demo' | 'unavailable';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  information: 'border-information/30 bg-information/10 text-information',
  ai: 'border-ai/30 bg-ai/10 text-ai',
  human: 'border-human/30 bg-human/10 text-human',
  pending: 'border-pending/30 bg-pending/10 text-pending',
  claimed: 'border-claimed/30 bg-claimed/10 text-claimed',
  escalated: 'border-escalated/30 bg-escalated/10 text-escalated',
  resolved: 'border-resolved/30 bg-resolved/10 text-resolved',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  stale: 'border-stale/30 bg-stale/10 text-stale',
  demo: 'border-demo/30 bg-demo/10 text-demo',
  unavailable: 'border-unavailable/30 bg-unavailable/10 text-unavailable',
};

export function StatusBadge({ tone = 'neutral', children, className }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return <span className={cn('state-badge', toneClasses[tone], className)}>{children}</span>;
}

type DataStateKind = 'loading' | 'empty' | 'error' | 'unavailable' | 'permission';

export function DataState({ kind, title, description, actionLabel, onAction, compact = false, className }: { kind: DataStateKind; title: string; description?: string; actionLabel?: string; onAction?: () => void; compact?: boolean; className?: string }) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'error' ? AlertCircle : kind === 'permission' ? TriangleAlert : kind === 'unavailable' ? Clock3 : Info;
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'min-h-32 p-4' : 'min-h-56 p-8', className)} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      <Icon className={cn('mb-3 h-6 w-6 text-muted-foreground', kind === 'loading' && 'animate-spin', kind === 'error' && 'text-destructive')} aria-hidden="true" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
      {actionLabel && onAction && <Button variant="secondary" className="mt-4" onClick={onAction}><RefreshCw className="h-4 w-4" />{actionLabel}</Button>}
    </div>
  );
}

export function InlineAlert({ tone = 'information', title, children, action, className }: { tone?: 'information' | 'success' | 'warning' | 'error' | 'stale'; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' || tone === 'stale' ? TriangleAlert : tone === 'error' ? AlertCircle : Info;
  const styles = tone === 'error' ? 'border-destructive/35 bg-destructive/[0.045] text-destructive' : tone === 'warning' || tone === 'stale' ? 'border-warning/35 bg-warning/[0.045] text-warning' : tone === 'success' ? 'border-success/35 bg-success/[0.045] text-success' : 'border-information/35 bg-information/[0.045] text-information';
  return (
    <div className={cn('flex items-start gap-3 rounded-sm border-0 border-l-2 p-3', styles, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p>{children && <div className="mt-0.5 text-sm text-current/80">{children}</div>}</div>
      {action}
    </div>
  );
}

export function LastUpdated({ value, stale = false }: { value?: Date | string | null; stale?: boolean }) {
  if (!value) return <StatusBadge tone="unavailable">Not updated</StatusBadge>;
  const date = value instanceof Date ? value : new Date(value);
  return <span className={cn('data-provenance', stale && 'text-stale')}><Clock3 className="h-3.5 w-3.5" />{stale ? 'Stale · ' : 'Updated '}{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
}

export function SearchField({ label, className, inputClassName, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; inputClassName?: string }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="visually-hidden">{label}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input type="search" className={cn('field-control w-full pl-9', inputClassName)} {...props} />
    </label>
  );
}

export function DismissButton({ onClick, label = 'Dismiss' }: { onClick: () => void; label?: string }) {
  return <IconButton label={label} onClick={onClick} className="h-9 min-h-9 w-9 min-w-9 border-transparent bg-transparent"><X className="h-4 w-4" /></IconButton>;
}

export type NotificationTone = 'success' | 'error' | 'warning' | 'information' | 'takeover' | 'bot' | 'connection';

export function ToastNotification({ tone = 'success', message, detail, actions, onDismiss }: { tone?: NotificationTone; message: string; detail?: string; actions?: ReactNode; onDismiss: () => void }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'takeover' ? UserRoundCheck : tone === 'bot' ? Bot : tone === 'connection' ? WifiOff : tone === 'information' ? Info : TriangleAlert;
  
  const containerStyle = tone === 'error'
    ? 'bg-gradient-to-r from-red-50 to-rose-50/90 border-red-200/90 text-red-950 dark:from-red-950/70 dark:to-rose-950/50 dark:border-red-900 dark:text-red-100'
    : tone === 'warning'
    ? 'bg-gradient-to-r from-amber-50 to-yellow-50/90 border-amber-200/90 text-amber-950 dark:from-amber-950/70 dark:to-yellow-950/50 dark:border-amber-900 dark:text-amber-100'
    : tone === 'success'
    ? 'bg-gradient-to-r from-emerald-50 to-teal-50/90 border-emerald-200/90 text-emerald-950 dark:from-emerald-950/70 dark:to-teal-950/50 dark:border-emerald-900 dark:text-emerald-100'
    : 'bg-gradient-to-r from-sky-50 to-indigo-50/90 border-sky-200/90 text-sky-950 dark:from-sky-950/70 dark:to-indigo-950/50 dark:border-sky-900 dark:text-sky-100';

  const iconBadgeStyle = tone === 'error'
    ? 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300'
    : tone === 'warning'
    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300'
    : tone === 'success'
    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300'
    : 'bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-300';

  return (
    <div
      className={cn(
        'relative flex w-full max-w-sm items-start gap-3 rounded-2xl border p-3.5 shadow-lg shadow-black/5 backdrop-blur-xs pointer-events-auto anim-slide-in select-none',
        containerStyle
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', iconBadgeStyle)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs font-bold leading-tight">{message}</p>
        {detail && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug opacity-90">{detail}</p>}
        {actions && <div className="mt-2.5 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('surface-section', className)} {...props} />;
}

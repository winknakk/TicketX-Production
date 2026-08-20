import { Check, X, Bot, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { HandoffStatusBadge } from '../common/HandoffStatusBadge';

export interface TakeoverHandoffCardProps {
  conversationId: string;
  customerName: string;
  avatarUrl?: string | null;
  lastMessage: string;
  reasonCode?: string;
  timestamp?: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function TakeoverHandoffCard({
  customerName,
  avatarUrl,
  lastMessage,
  reasonCode,
  timestamp = 'Just now',
  onAccept,
  onDismiss,
}: TakeoverHandoffCardProps) {
  const isReviewNeeded = reasonCode === 'ANSWER_NOT_FOUND';
  const titleText = isReviewNeeded ? 'Answer Needs Review' : 'Human Handoff Requested';
  const initials = (customerName || 'Customer')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-sm pointer-events-auto anim-slide-in select-none">
      <div className="relative bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 shadow-xl shadow-black/5 rounded-2xl p-4 transition-all">
        <div className="flex items-start gap-3">
          {/* Customer Avatar + Live Dot */}
          <div className="relative h-11 w-11 shrink-0 mt-0.5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={customerName}
                className="h-11 w-11 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
              />
            ) : (
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                {initials}
              </div>
            )}
            <div
              className={cn(
                'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-900',
                isReviewNeeded ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              )}
            />
          </div>

          {/* Info Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <HandoffStatusBadge
                status={isReviewNeeded ? 'pending' : 'PENDING_HUMAN'}
                label={titleText}
              />
            </div>

            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
              {customerName}
            </p>

            <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-tight mt-1 font-normal">
              "{lastMessage}"
            </p>

            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2 font-medium">
              {timestamp}
            </p>
          </div>

          {/* Action Buttons (Dismiss ✕ & Accept ✓) */}
          <div className="flex items-center gap-1.5 shrink-0 self-center">
            {/* Dismiss */}
            <button
              type="button"
              onClick={onDismiss}
              title="Dismiss alert"
              className="rounded-xl flex items-center justify-center h-8 w-8 p-0 bg-zinc-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-950/50 text-zinc-400 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors border border-zinc-200/50 dark:border-zinc-700/50 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Accept & Takeover */}
            <button
              type="button"
              onClick={onAccept}
              title="Accept & Take Over Room"
              className={cn(
                'rounded-xl flex items-center justify-center h-8 w-8 p-0',
                'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs shadow-emerald-500/30',
                'transition-colors font-bold cursor-pointer'
              )}
            >
              <Check className="h-4.5 w-4.5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { StatusBadge } from '../ui/Primitives';

export type HandoffStatus =
  | 'PENDING_HUMAN'
  | 'ACTIVE_HUMAN'
  | 'AI_ACTIVE'
  | 'RETURNED_TO_AI'
  | 'CLAIMED'
  | 'human'
  | 'ai'
  | 'pending'
  | string;

export interface HandoffStatusBadgeProps {
  status?: HandoffStatus;
  handledBy?: 'ai' | 'human' | string;
  takeoverStatus?: string;
  label?: string;
  className?: string;
  showDot?: boolean;
}

export function HandoffStatusBadge({
  status,
  handledBy,
  takeoverStatus,
  label,
  className = '',
  showDot = true,
}: HandoffStatusBadgeProps) {
  let resolvedStatus = (status || takeoverStatus || '').toUpperCase();
  if (!resolvedStatus && handledBy) {
    resolvedStatus = handledBy.toUpperCase() === 'AI' ? 'AI_ACTIVE' : 'ACTIVE_HUMAN';
  }

  let tone: 'pending' | 'escalated' | 'human' | 'ai' | 'claimed' | 'neutral' = 'neutral';
  let displayLabel = label;
  let dotColor = 'bg-slate-400';
  let animatePulse = false;

  switch (resolvedStatus) {
    case 'PENDING_HUMAN':
    case 'PENDING':
      tone = 'pending';
      displayLabel = displayLabel || 'Pending Human';
      dotColor = 'bg-red-500';
      animatePulse = true;
      break;

    case 'ACTIVE_HUMAN':
    case 'HUMAN':
      tone = 'human';
      displayLabel = displayLabel || 'Human Active';
      dotColor = 'bg-emerald-500';
      break;

    case 'AI_ACTIVE':
    case 'AI':
      tone = 'ai';
      displayLabel = displayLabel || 'AI Active';
      dotColor = 'bg-emerald-500';
      animatePulse = true;
      break;

    case 'RETURNED_TO_AI':
      tone = 'ai';
      displayLabel = displayLabel || 'Returned to AI';
      dotColor = 'bg-blue-500';
      break;

    case 'CLAIMED':
      tone = 'claimed';
      displayLabel = displayLabel || 'Claimed';
      dotColor = 'bg-blue-500';
      break;

    default:
      tone = 'neutral';
      displayLabel = displayLabel || resolvedStatus || 'Unknown';
      break;
  }

  return (
    <StatusBadge tone={tone} className={`inline-flex items-center gap-1.5 ${className}`}>
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColor} ${animatePulse ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </StatusBadge>
  );
}

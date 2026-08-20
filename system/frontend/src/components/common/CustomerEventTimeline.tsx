import React from 'react';
import type { CustomerTimelineEvent, TimelineEventType } from '../../types/domain';
import {
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Bot,
  Ticket as TicketIcon,
  AlertTriangle,
  Link,
  Clock,
  CheckCircle,
} from 'lucide-react';

export interface CustomerEventTimelineProps {
  events: CustomerTimelineEvent[];
  className?: string;
}

function getEventIcon(type: TimelineEventType) {
  switch (type) {
    case 'CONVERSATION_STARTED':
    case 'MESSAGE_RECEIVED':
      return <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />;
    case 'IDENTITY_BOUND':
      return <Link className="h-3.5 w-3.5 text-blue-500" />;
    case 'IDENTITY_VERIFIED':
    case 'OTP_SUCCESS':
      return <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />;
    case 'OTP_FAILED':
    case 'SLA_BREACHED':
      return <ShieldAlert className="h-3.5 w-3.5 text-red-500" />;
    case 'HUMAN_TAKEOVER_REQUESTED':
    case 'HUMAN_TAKEOVER_CLAIMED':
      return <UserCheck className="h-3.5 w-3.5 text-amber-500" />;
    case 'RETURNED_TO_AI':
      return <Bot className="h-3.5 w-3.5 text-emerald-500" />;
    case 'TICKET_CREATED':
    case 'PLANE_ESCALATION':
      return <TicketIcon className="h-3.5 w-3.5 text-purple-500" />;
    case 'TICKET_CLOSED':
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
    case 'SLA_RISK':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function CustomerEventTimeline({ events, className = '' }: CustomerEventTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No event history recorded on timeline.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Customer Event Timeline ({events.length})
      </p>
      <div className="relative border-l border-border/80 ml-2 space-y-4">
        {events.map((event) => (
          <div key={event.id} className="relative pl-5 text-xs">
            {/* Timeline Icon Node */}
            <div className="absolute -left-2 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background border border-border">
              {getEventIcon(event.eventType)}
            </div>

            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-foreground">{event.title}</span>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {event.timestamp}
              </span>
            </div>

            {event.description && (
              <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                {event.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

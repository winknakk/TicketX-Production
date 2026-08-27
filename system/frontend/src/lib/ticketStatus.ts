/**
 * TicketX customer lifecycle, mirrored from
 * system/backend/src/domain/ticket/TicketLifecycle.ts.
 *
 * tickets.status holds this vocabulary since migration 040. Plane's
 * engineering state lives in a separate plane_status field, so the console
 * must not mix the two: a ticket can be Done in Plane while still waiting for
 * the customer to confirm.
 */

export const LIFECYCLE_STATUSES = [
  'NEW',
  'TRIAGED',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_INTERNAL',
  'RESOLVED',
  'CUSTOMER_CONFIRMED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/** Human-readable labels for operators. */
export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  TRIAGED: 'Triaged',
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_CUSTOMER: 'Waiting on Customer',
  WAITING_INTERNAL: 'Waiting Internal',
  RESOLVED: 'Resolved — awaiting confirmation',
  CUSTOMER_CONFIRMED: 'Confirmed by Customer',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  CANCELLED: 'Cancelled',
};

export function statusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status] ?? status;
}

/**
 * Filter groups the console offers. RESOLVED is deliberately its own group
 * rather than folded into "closed": those tickets are still open business
 * until the customer confirms, and they are the queue an agent should watch.
 */
export const STATUS_FILTERS = {
  all: null,
  open: ['NEW', 'TRIAGED', 'OPEN', 'IN_PROGRESS', 'REOPENED'],
  waiting: ['WAITING_CUSTOMER', 'WAITING_INTERNAL'],
  resolved: ['RESOLVED'],
  closed: ['CUSTOMER_CONFIRMED', 'CLOSED'],
  cancelled: ['CANCELLED'],
} as const;

export type StatusFilter = keyof typeof STATUS_FILTERS;

export function matchesFilter(status: string | undefined | null, filter: StatusFilter): boolean {
  const group = STATUS_FILTERS[filter];
  if (!group) return true;
  return group.includes((status || '') as never);
}

/** Visual tone for a status badge. */
export function statusTone(
  status?: string | null
): 'resolved' | 'claimed' | 'pending' | 'unavailable' | 'escalated' {
  switch (status) {
    case 'CLOSED':
    case 'CUSTOMER_CONFIRMED':
      return 'resolved';
    case 'RESOLVED':
      // Not "resolved" tone: it still needs the customer, and colouring it as
      // finished is what makes an agent stop watching it.
      return 'claimed';
    case 'IN_PROGRESS':
    case 'REOPENED':
      return 'escalated';
    case 'WAITING_CUSTOMER':
    case 'WAITING_INTERNAL':
      return 'pending';
    case 'CANCELLED':
      return 'unavailable';
    default:
      return 'pending';
  }
}

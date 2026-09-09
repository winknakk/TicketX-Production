import { MessageSquare, Ticket, HelpCircle } from 'lucide-react';
import type { CustomerAppRoute } from './types';

/**
 * Single source of truth for customer portal route labels — the counterpart of
 * `lib/navigation.ts` on the operator side.
 *
 * The sidebar and the header both name the current route; keeping the strings
 * in one place is what stops them drifting apart, which is the whole point of
 * the portal/admin alignment work.
 */
export const customerNavigation = [
  { id: 'home', label: 'แชทช่วยเหลือ (Chat)', shortLabel: 'แชท', icon: MessageSquare },
  { id: 'tickets', label: 'ตั๋วของฉัน (My Tickets)', shortLabel: 'ตั๋วของฉัน', icon: Ticket },
  { id: 'help', label: 'ศูนย์ช่วยเหลือ (Help)', shortLabel: 'ช่วยเหลือ', icon: HelpCircle },
] as const;

/** `ticket-detail` has no nav entry of its own — it reads as a child of Tickets. */
export function getCustomerRouteLabel(route: CustomerAppRoute): string {
  if (route === 'ticket-detail') return 'รายละเอียดตั๋ว';
  return customerNavigation.find((item) => item.id === route)?.label ?? route;
}

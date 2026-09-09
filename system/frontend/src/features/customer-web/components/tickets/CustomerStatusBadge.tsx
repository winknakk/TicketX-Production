import React from 'react';
import { StatusBadge } from '../../../../components/ui/Primitives';

/**
 * Customer-facing ticket status.
 *
 * The Thai labels are product copy and stay exactly as they were. What changed
 * is the rendering: this used to hand-roll a rounded-full pill with its own
 * sky/indigo/amber/teal palette, so the same ticket looked different to a
 * customer than to an operator. It now delegates to the shared `StatusBadge`,
 * which is the badge the admin Tickets page uses.
 *
 * `tone` deliberately never uses `'resolved'`: `Primitives.tsx` declares that
 * tone but `index.css` defines no `--resolved` token, so it renders colourless.
 * RESOLVED maps to `success` instead.
 */
type StatusTone =
  | 'neutral'
  | 'information'
  | 'claimed'
  | 'pending'
  | 'warning'
  | 'success'
  | 'escalated'
  | 'unavailable';

export interface CustomerStatusConfig {
  label: string;
  tone: StatusTone;
}

export function getCustomerStatusConfig(status?: string | null): CustomerStatusConfig {
  const normalized = (status || '').toUpperCase().trim();

  switch (normalized) {
    case 'NEW':
      return { label: 'รับเรื่องแล้ว', tone: 'information' };
    case 'TRIAGED':
      return { label: 'กำลังจัดสรรผู้ดูแล', tone: 'information' };
    case 'OPEN':
      return { label: 'เปิดงานแล้ว', tone: 'claimed' };
    case 'IN_PROGRESS':
      return { label: 'กำลังดำเนินการ', tone: 'claimed' };
    case 'WAITING_CUSTOMER':
      return { label: 'รอข้อมูลเพิ่มเติมจากคุณ', tone: 'warning' };
    case 'WAITING_INTERNAL':
      return { label: 'กำลังประสานงานภายใน', tone: 'pending' };
    case 'RESOLVED':
      return { label: 'แก้ไขแล้ว — รอคุณยืนยัน', tone: 'success' };
    case 'CUSTOMER_CONFIRMED':
      return { label: 'คุณยืนยันผลแล้ว', tone: 'success' };
    case 'CLOSED':
      return { label: 'ปิดงานเรียบร้อย', tone: 'success' };
    case 'REOPENED':
      return { label: 'เปิดเรื่องใหม่', tone: 'escalated' };
    case 'CANCELLED':
      return { label: 'ยกเลิกแล้ว', tone: 'unavailable' };
    default:
      return { label: status || 'รอดำเนินการ', tone: 'neutral' };
  }
}

export function CustomerStatusBadge({ status }: { status?: string | null }) {
  const config = getCustomerStatusConfig(status);
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}

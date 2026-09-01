import React from 'react';

export interface CustomerStatusConfig {
  label: string;
  tone: 'info' | 'pending' | 'warning' | 'success' | 'escalated' | 'muted';
  bgClass: string;
  textClass: string;
  dotClass: string;
}

export function getCustomerStatusConfig(status?: string | null): CustomerStatusConfig {
  const normalized = (status || '').toUpperCase().trim();

  switch (normalized) {
    case 'NEW':
      return {
        label: 'รับเรื่องแล้ว',
        tone: 'info',
        bgClass: 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300',
        textClass: 'text-sky-700 dark:text-sky-300',
        dotClass: 'bg-sky-500',
      };
    case 'TRIAGED':
      return {
        label: 'กำลังจัดสรรผู้ดูแล',
        tone: 'info',
        bgClass: 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300',
        textClass: 'text-sky-700 dark:text-sky-300',
        dotClass: 'bg-sky-500',
      };
    case 'OPEN':
      return {
        label: 'เปิดงานแล้ว',
        tone: 'pending',
        bgClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300',
        textClass: 'text-indigo-700 dark:text-indigo-300',
        dotClass: 'bg-indigo-500',
      };
    case 'IN_PROGRESS':
      return {
        label: 'กำลังดำเนินการ',
        tone: 'escalated',
        bgClass: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
        textClass: 'text-amber-700 dark:text-amber-300',
        dotClass: 'bg-amber-500 animate-pulse',
      };
    case 'WAITING_CUSTOMER':
      return {
        label: 'รอข้อมูลเพิ่มเติมจากคุณ',
        tone: 'warning',
        bgClass: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300',
        textClass: 'text-orange-700 dark:text-orange-300',
        dotClass: 'bg-orange-500',
      };
    case 'WAITING_INTERNAL':
      return {
        label: 'กำลังประสานงานภายใน',
        tone: 'pending',
        bgClass: 'bg-slate-500/10 border-slate-500/20 text-slate-700 dark:text-slate-300',
        textClass: 'text-slate-700 dark:text-slate-300',
        dotClass: 'bg-slate-500',
      };
    case 'RESOLVED':
      return {
        label: 'แก้ไขแล้ว — รอคุณยืนยัน',
        tone: 'success',
        bgClass: 'bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-300 font-medium',
        textClass: 'text-teal-700 dark:text-teal-300',
        dotClass: 'bg-teal-500 ring-2 ring-teal-400/30',
      };
    case 'CUSTOMER_CONFIRMED':
      return {
        label: 'คุณยืนยันผลแล้ว',
        tone: 'success',
        bgClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        textClass: 'text-emerald-700 dark:text-emerald-300',
        dotClass: 'bg-emerald-500',
      };
    case 'CLOSED':
      return {
        label: 'ปิดงานเรียบร้อย',
        tone: 'success',
        bgClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
        textClass: 'text-emerald-700 dark:text-emerald-300',
        dotClass: 'bg-emerald-500',
      };
    case 'REOPENED':
      return {
        label: 'เปิดเรื่องใหม่',
        tone: 'escalated',
        bgClass: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300',
        textClass: 'text-rose-700 dark:text-rose-300',
        dotClass: 'bg-rose-500 animate-pulse',
      };
    case 'CANCELLED':
      return {
        label: 'ยกเลิกแล้ว',
        tone: 'muted',
        bgClass: 'bg-muted border-border text-muted-foreground',
        textClass: 'text-muted-foreground',
        dotClass: 'bg-muted-foreground/60',
      };
    default:
      return {
        label: status || 'รอดำเนินการ',
        tone: 'pending',
        bgClass: 'bg-muted border-border text-foreground',
        textClass: 'text-foreground',
        dotClass: 'bg-muted-foreground',
      };
  }
}

export function CustomerStatusBadge({
  status,
  size = 'md',
}: {
  status?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = getCustomerStatusConfig(status);

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border border-solid ${config.bgClass} ${sizeClasses}`}
      role="status"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}

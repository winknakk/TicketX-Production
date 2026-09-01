import React, { useState } from 'react';
import type { CustomerTicket } from '../../types';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../../../components/ui/Primitives';

export function CustomerTicketCard({
  ticket,
  onSelect,
}: {
  ticket: CustomerTicket;
  onSelect: (ticket: CustomerTicket) => void;
}) {
  const ticketRef = ticket.ticket_number || ticket.ticket_id || `TCK-${ticket.id}`;
  const formattedDate = ticket.created_at
    ? new Date(ticket.created_at).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <button
      onClick={() => onSelect(ticket)}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 sm:p-5 text-left transition-all hover:border-zinc-700 hover:bg-zinc-900 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`ตั๋ว ${ticketRef}: ${ticket.subject}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-zinc-400">
            {ticketRef}
          </span>
          {formattedDate && (
            <span className="text-[11px] text-zinc-500">• {formattedDate}</span>
          )}
        </div>
        <CustomerStatusBadge status={ticket.status} size="sm" />
      </div>

      <div>
        <h4 className="text-sm sm:text-base font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
          {ticket.subject}
        </h4>
        {ticket.summary && (
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {ticket.summary}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 text-xs text-zinc-500">
        <span>คลิกเพื่อดูความคืบหน้า</span>
        <ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
      </div>
    </button>
  );
}

export function CustomerResolutionCard({
  status,
  isTransitioning,
  onConfirm,
  onReopen,
}: {
  status: string;
  isTransitioning: boolean;
  onConfirm: () => Promise<void>;
  onReopen: (reason?: string) => Promise<void>;
}) {
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);

  if (status !== 'RESOLVED') return null;

  return (
    <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-5 sm:p-6 text-card-foreground shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            ปัญหาได้รับการแก้ไขแล้วหรือยังคะ?
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            ทีมงานได้ดำเนินการแก้ไขปัญหาในตั๋วนี้เรียบร้อยแล้ว กรุณาตรวจสอบและกดปุ่มยืนยันผลการแก้ไข หรือแจ้งหากยังพบปัญหาอยู่ค่ะ
          </p>
        </div>
      </div>

      {showReopenInput ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="ระบุรายละเอียดปัญหาที่ยังพบอยู่..."
            className="w-full rounded-xl border border-border bg-background p-3 text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              disabled={isTransitioning}
              onClick={() => onReopen(reopenReason)}
              className="gap-1.5"
            >
              <AlertCircle className="h-4 w-4" />
              <span>{isTransitioning ? 'กำลังส่งข้อมูล...' : 'ยืนยันการเปิดเรื่องใหม่'}</span>
            </Button>
            <Button
              variant="secondary"
              disabled={isTransitioning}
              onClick={() => setShowReopenInput(false)}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={isTransitioning}
            onClick={onConfirm}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isTransitioning ? 'กำลังบันทึก...' : 'ยืนยันว่าแก้ไขแล้ว'}</span>
          </Button>

          <Button
            variant="secondary"
            disabled={isTransitioning}
            onClick={() => setShowReopenInput(true)}
            className="gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900"
          >
            <AlertCircle className="h-4 w-4" />
            <span>ยังพบปัญหาอยู่</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function CustomerTicketTimeline({
  status,
  createdAt,
  updatedAt,
}: {
  status: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  const steps = [
    { title: 'รับเรื่องแล้ว', activeWhen: ['NEW', 'TRIAGED', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CUSTOMER_CONFIRMED', 'CLOSED'] },
    { title: 'กำลังดำเนินการ', activeWhen: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CUSTOMER_CONFIRMED', 'CLOSED'] },
    { title: 'แก้ไขเสร็จสิ้น', activeWhen: ['RESOLVED', 'CUSTOMER_CONFIRMED', 'CLOSED'] },
    { title: 'ปิดงานเรียบร้อย', activeWhen: ['CUSTOMER_CONFIRMED', 'CLOSED'] },
  ];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-xs">
      <h3 className="text-sm font-semibold text-foreground mb-4">ลำดับขั้นตอนการดูแล</h3>
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        {steps.map((step, idx) => {
          const isDone = step.activeWhen.includes(status.toUpperCase());
          return (
            <div key={idx} className="flex items-center gap-3 sm:flex-col sm:text-center flex-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-muted/40 text-muted-foreground'
                }`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              <div>
                <p className={`text-xs font-medium ${isDone ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                  {step.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

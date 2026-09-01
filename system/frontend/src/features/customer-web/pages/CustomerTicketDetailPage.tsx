import React from 'react';
import type { CustomerTicket, CustomerAppRoute } from '../types';
import { useCustomerTicketDetail } from '../hooks/useCustomerTickets';
import { CustomerStatusBadge } from '../components/tickets/CustomerStatusBadge';
import { CustomerResolutionCard, CustomerTicketTimeline } from '../components/tickets/CustomerTicketComponents';
import { ArrowLeft, RefreshCw, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Primitives';

export function CustomerTicketDetailPage({
  ticketId,
  onBack,
  onNavigate,
}: {
  ticketId: string | number;
  onBack: () => void;
  onNavigate: (route: CustomerAppRoute) => void;
}) {
  const {
    ticket,
    isLoading,
    error,
    isTransitioning,
    refreshDetail,
    transitionStatus,
  } = useCustomerTicketDetail(ticketId);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span>กำลังโหลดข้อมูลตั๋ว...</span>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">
          {error?.message || 'ไม่พบข้อมูลตั๋วที่ต้องการ'}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          ตั๋วนี้อาจไม่มีอยู่ หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลของตั๋วนี้ค่ะ
        </p>
        <Button
          variant="secondary"
          onClick={onBack}
          className="mt-5 gap-2 text-xs rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>กลับสู่หน้ารายการตั๋ว</span>
        </Button>
      </div>
    );
  }

  const ticketRef = ticket.ticket_number || ticket.ticket_id || `TCK-${ticket.id}`;
  const createdDate = ticket.created_at
    ? new Date(ticket.created_at).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return (
    <div className="mx-auto max-w-3xl w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Back button & Action bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg py-1 px-1.5"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>กลับสู่หน้ารายการตั๋ว</span>
        </button>

        <Button
          variant="secondary"
          onClick={() => refreshDetail()}
          className="gap-1.5 text-xs h-8 rounded-lg"
          aria-label="รีเฟรชข้อมูลตั๋ว"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">รีเฟรช</span>
        </Button>
      </div>

      {/* Ticket Header Card */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              {ticketRef}
            </span>
            {createdDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{createdDate}</span>
              </span>
            )}
          </div>
          <CustomerStatusBadge status={ticket.status} size="md" />
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
            {ticket.subject}
          </h2>
          {ticket.summary && (
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {ticket.summary}
            </p>
          )}
        </div>
      </div>

      {/* Resolution Confirmation Card (Interactive Confirm/Reopen) */}
      <CustomerResolutionCard
        status={ticket.status}
        isTransitioning={isTransitioning}
        onConfirm={async () => {
          await transitionStatus('CUSTOMER_CONFIRMED');
        }}
        onReopen={async (reason) => {
          await transitionStatus('REOPENED', reason);
        }}
      />

      {/* Lifecycle Progress Timeline */}
      <CustomerTicketTimeline
        status={ticket.status}
        createdAt={ticket.created_at}
        updatedAt={ticket.updated_at}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { CustomerChatStream, CustomerChatComposer } from '../components/chat/CustomerChatComponents';
import { CustomerTicketCard } from '../components/tickets/CustomerTicketComponents';
import { CreateTicketDrawer } from '../components/tickets/CreateTicketDrawer';
import { useCustomerChat } from '../chat/CustomerChatContext';
import { useCustomerTickets } from '../hooks/useCustomerTickets';
import { useCustomerSession } from '../auth/CustomerSessionContext';
import type { CustomerAppRoute, CustomerTicket } from '../types';
import { Plus, Ticket, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/Primitives';

export function CustomerHomePage({
  onNavigate,
  onSelectTicket,
}: {
  onNavigate: (route: CustomerAppRoute) => void;
  onSelectTicket: (ticket: CustomerTicket) => void;
}) {
  const { isGuest, setIsSettingsOpen } = useCustomerSession();
  const { entries, isTyping, isSending, isConnected, sendMessage, sendPostback, retrySend, pendingAction } =
    useCustomerChat();
  const { tickets, createTicket } = useCustomerTickets();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  /**
   * Quick-action chips. The backend answers every tap with its own reply, and
   * the two it currently sends map onto portal capability that already exists —
   * so the local side effect is opening the drawer or changing route, never a
   * second implementation of either.
   */
  const LINE_QUICK_ACTIONS = [
    { label: "🚀 เริ่มใช้งาน", value: "start" },
    { label: "📝 แจ้งปัญหา", value: "report_issue", style: "primary" },
    { label: "🔍 ตรวจสอบสถานะ", value: "check_status" },
    { label: "✅ ปิดเคส", value: "close_case" },
    { label: "🔄 เปลี่ยนโปรเจกต์", value: "change_project" },
    { label: "🔗 เชื่อมใหม่", value: "connect_new" },
  ];

  const lastActionTimeRef = React.useRef<number>(0);

  const handleAction = (value: string) => {
    const now = Date.now();
    if (now - lastActionTimeRef.current < 500) {
      return; // Debounce rapid double-clicks
    }
    lastActionTimeRef.current = now;

    const v = (value || '').trim();
    if (v === 'report_issue' || v === 'แจ้งปัญหา' || v === 'เปิดตั๋ว' || v === 'เปิดตั๋วแจ้งปัญหาใหม่') {
      setIsCreateOpen(true);
      return;
    }
    if (v === 'check_status' || v === 'ตรวจสอบสถานะ' || v === 'ดูสถานะ') {
      onNavigate('tickets');
      return;
    }
    if (v === 'change_project' || v === 'สลับโปรเจกต์' || v === 'เปลี่ยนโปรเจกต์' || v === 'connect_new' || v === 'เชื่อมใหม่') {
      setIsSettingsOpen(true);
      return;
    }
    // Fallback for conversational action chips (e.g. start, close_case)
    sendPostback(value);
  };

  const activeTickets = tickets.filter(
    (t) => !['CLOSED', 'CUSTOMER_CONFIRMED', 'CANCELLED'].includes(t.status?.toUpperCase() || '')
  ).slice(0, 3);

  return (
    <div className="flex h-full flex-col lg:flex-row min-w-0 bg-background text-foreground transition-colors">
      {/* Primary Hero: Support Conversation Area */}
      <div className="flex flex-1 flex-col h-full min-w-0 border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 bg-card/60 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-foreground">AI Support Agent (พร้อมให้บริการ)</span>
          </div>

          {!isGuest && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>เปิดตั๋วใหม่</span>
            </button>
          )}
        </div>

        <CustomerChatStream
          entries={entries}
          isTyping={isTyping}
          isReconnecting={!isConnected}
          onAction={handleAction}
          onRetry={retrySend}
          pendingAction={pendingAction}
          isSending={isSending}
        />
        <CustomerChatComposer
          onSendMessage={sendMessage}
          isSending={isSending}
          quickActions={LINE_QUICK_ACTIONS}
          onSelectAction={handleAction}
        />
      </div>

      {/* Secondary Context: Active Ticket Glance (Desktop Right Panel) */}
      {!isGuest && (
        <aside className="hidden lg:flex w-80 flex-col bg-card/30 border-l border-border p-5 shrink-0 overflow-y-auto" aria-label="Active Tickets Context">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">รายการที่กำลังดำเนินการ</h3>
            </div>
            {tickets.length > 0 && (
              <button
                onClick={() => onNavigate('tickets')}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <span>ดูทั้งหมด</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {activeTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
              <p>ไม่มีรายการที่รอดำเนินการ</p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>แจ้งปัญหาใหม่</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTickets.map((t) => (
                <CustomerTicketCard key={t.id} ticket={t} onSelect={onSelectTicket} />
              ))}
            </div>
          )}
        </aside>
      )}

      <CreateTicketDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (data) => {
          return await createTicket(data);
        }}
      />
    </div>
  );
}

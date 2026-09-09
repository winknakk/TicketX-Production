import React, { useState, useMemo } from 'react';
import type { CustomerTicket, CustomerAppRoute } from '../types';
import { useCustomerTickets } from '../hooks/useCustomerTickets';
import { useCustomerSession } from '../auth/CustomerSessionContext';
import { CustomerTicketCard } from '../components/tickets/CustomerTicketComponents';
import { CreateTicketDrawer } from '../components/tickets/CreateTicketDrawer';
import { GuestNoticeCard } from '../components/common/CustomerAuthAlerts';
import { Plus, RefreshCw } from 'lucide-react';
import { Button, DataState, PageHeader, SearchField } from '../../../components/ui/Primitives';

type FilterTab = 'all' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

export function CustomerTicketsPage({
  onNavigate,
  onSelectTicket,
}: {
  onNavigate: (route: CustomerAppRoute) => void;
  onSelectTicket: (ticket: CustomerTicket) => void;
}) {
  const { isGuest } = useCustomerSession();
  const { tickets, isLoading, refreshTickets, createTicket } = useCustomerTickets();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Search keyword
      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        t.subject?.toLowerCase().includes(query) ||
        t.summary?.toLowerCase().includes(query) ||
        t.ticket_number?.toLowerCase().includes(query);

      if (!matchSearch) return false;

      // 2. Status Category
      const s = (t.status || '').toUpperCase();
      if (activeFilter === 'all') return true;
      if (activeFilter === 'in_progress') return ['NEW', 'TRIAGED', 'OPEN', 'IN_PROGRESS', 'REOPENED'].includes(s);
      if (activeFilter === 'waiting') return ['WAITING_CUSTOMER', 'WAITING_INTERNAL'].includes(s);
      if (activeFilter === 'resolved') return ['RESOLVED'].includes(s);
      if (activeFilter === 'closed') return ['CUSTOMER_CONFIRMED', 'CLOSED', 'CANCELLED'].includes(s);
      return true;
    });
  }, [tickets, searchTerm, activeFilter]);

  if (isGuest) {
    return (
      <div className="flex h-full items-center justify-center p-4 sm:p-8">
        <GuestNoticeCard onSwitchToChat={() => onNavigate('home')} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl w-full p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        eyebrow="ศูนย์ช่วยเหลือลูกค้า"
        title="ประวัติการแจ้งปัญหา (My Tickets)"
        description="ติดตามสถานะและประวัติการดำเนินการของคำขอทั้งหมด"
        actions={
          <>
            <Button variant="secondary" onClick={() => refreshTickets()} aria-label="รีเฟรชข้อมูล">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </Button>
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>เปิดตั๋วใหม่</span>
            </Button>
          </>
        }
      />

      {/* Search + status filter — same anatomy as the admin Tickets page */}
      <div className="space-y-3">
        <SearchField
          label="ค้นหาตั๋ว"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาตามเลขตั๋ว หรือหัวข้อปัญหา..."
        />

        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
          role="group"
          aria-label="กรองตามสถานะตั๋ว"
        >
          {(
            [
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'in_progress', label: 'กำลังดำเนินการ' },
              { id: 'waiting', label: 'รอข้อมูล' },
              { id: 'resolved', label: 'รอคุณยืนยัน' },
              { id: 'closed', label: 'ปิดงานแล้ว' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              aria-pressed={activeFilter === tab.id}
              className={`touch-target shrink-0 rounded-md px-3 text-xs font-semibold transition-colors ${
                activeFilter === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="rounded-xl border border-border bg-card">
          <DataState kind="loading" title="กำลังโหลดรายการตั๋วของคุณ…" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <DataState
            kind="empty"
            title={searchTerm ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'ยังไม่มีรายการแจ้งปัญหา'}
            description={
              searchTerm
                ? 'ลองค้นหาด้วยคำอื่น หรือล้างคำค้นหาเพื่อดูตั๋วทั้งหมด'
                : 'เมื่อคุณแจ้งปัญหาผ่านแชท หรือเปิดตั๋วใหม่ รายการจะปรากฏที่นี่ค่ะ'
            }
          />
          {!searchTerm && (
            <div className="flex justify-center pb-8">
              <Button variant="secondary" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                <span>เปิดตั๋วแจ้งปัญหา</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1">
          {filteredTickets.map((ticket) => (
            <CustomerTicketCard
              key={ticket.id}
              ticket={ticket}
              onSelect={onSelectTicket}
            />
          ))}
        </div>
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

import React, { useState, useMemo } from 'react';
import type { CustomerTicket, CustomerAppRoute } from '../types';
import { useCustomerTickets } from '../hooks/useCustomerTickets';
import { useCustomerSession } from '../auth/CustomerSessionContext';
import { CustomerTicketCard } from '../components/tickets/CustomerTicketComponents';
import { CreateTicketDrawer } from '../components/tickets/CreateTicketDrawer';
import { GuestNoticeCard } from '../components/common/CustomerAuthAlerts';
import { Search, Plus, RefreshCw, Ticket } from 'lucide-react';
import { Button } from '../../../components/ui/Primitives';

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
      {/* Header & New Ticket Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            ประวัติการแจ้งปัญหา (My Tickets)
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            ติดตามสถานะและประวัติการดำเนินการของคำขอทั้งหมด
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => refreshTickets()}
            className="gap-1.5 text-xs h-9 rounded-xl"
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 text-xs h-9 rounded-xl shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>เปิดตั๋วใหม่</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามเลขตั๋ว หรือหัวข้อปัญหา..."
            className="w-full rounded-2xl border border-border bg-card pl-10 pr-4 py-2.5 text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
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
              onClick={() => setActiveFilter(tab.id)}
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span>กำลังโหลดรายการตั๋วของคุณ...</span>
          </div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center bg-card/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Ticket className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            {searchTerm ? 'ไม่พบรายการที่ตรงกับคำค้นหา' : 'ยังไม่มีรายการแจ้งปัญหา'}
          </h3>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {searchTerm
              ? 'ลองค้นหาด้วยคำอื่น หรือล้างคำค้นหาเพื่อดูตั๋วทั้งหมด'
              : 'เมื่อคุณแจ้งปัญหาผ่านแชท หรือเปิดตั๋วใหม่ รายการจะปรากฏที่นี่ค่ะ'}
          </p>
          {!searchTerm && (
            <Button
              variant="secondary"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-1.5 text-xs rounded-xl"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>เปิดตั๋วแจ้งปัญหา</span>
            </Button>
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
          await createTicket(data);
        }}
      />
    </div>
  );
}

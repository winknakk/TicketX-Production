import { Search, MessageSquare } from 'lucide-react';
import { useConversation } from '../../context/ConversationContext';
import { cn } from '../../lib/utils';
import { DataState } from '../ui/Primitives';

export const SidebarInbox: React.FC<{ className?: string; onCustomerSelected?: () => void; loading?: boolean; error?: string | null }> = ({ className, onCustomerSelected, loading = false, error = null }) => {
  const {
    selectedCustomerId,
    setSelectedCustomerId,
    setActiveChannelTab,
    filterTab,
    setFilterTab,
    searchQuery,
    setSearchQuery,
    sortedCustomers
  } = useConversation();

  // Selection handler
  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id);
    const available = Object.keys(customer.conversations);
    if (available.length > 0) {
      setActiveChannelTab(available[0] as any);
    } else {
      setActiveChannelTab('line');
    }
    onCustomerSelected?.();
  };

  const filteredSortedCustomers = sortedCustomers.filter((cust) => {
    const custName = cust.name || '';
    const custCompany = cust.company || '';
    const custEmail = cust.email || '';
    const custPhone = cust.phone || '';
    const custId = String(cust.id || '');

    const matchesSearch =
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custId.includes(searchQuery) ||
      Object.values(cust.conversations || {}).some((c: any) => {
        const ticketIds = String(c?.ticket_ids || '');
        const messageContents = String(c?.message_contents || '');
        const lastMsg = String(c?.last_message || '');
        return (
          lastMsg.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticketIds.toLowerCase().includes(searchQuery.toLowerCase()) ||
          messageContents.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });

    if (filterTab === 'ai') {
      return matchesSearch && Object.values(cust.conversations || {}).some((c: any) => c?.handled_by === 'ai');
    }
    if (filterTab === 'human') {
      return matchesSearch && Object.values(cust.conversations || {}).some((c: any) => c?.handled_by === 'human');
    }
    if (filterTab === 'pending') {
      return matchesSearch && Object.values(cust.conversations || {}).some((c: any) => c?.takeover_status === 'PENDING_HUMAN');
    }
    return matchesSearch;
  });

  return (
    <aside className={cn("w-full border-r border-border flex flex-col bg-card shrink-0 md:w-64 xl:w-72", className)} aria-label="Conversation queue">
      {/* Search & Tabs */}
      <div className="border-b border-border px-3 py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <label className="visually-hidden" htmlFor="conversation-search">Search conversations</label>
          <input
            id="conversation-search"
            type="text"
            placeholder="Search customers..."
            className="field-control w-full pl-9 pr-4 text-sm bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      </div>

      {/* Customer List Scroll */}
      <div className="flex-1 overflow-y-auto">
        {loading && sortedCustomers.length === 0 ? (
          <DataState compact kind="loading" title="Loading conversation queue" />
        ) : error && sortedCustomers.length === 0 ? (
          <DataState compact kind="error" title="Conversation queue unavailable" description={error} />
        ) : filteredSortedCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12 text-center">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-xs font-medium">No customers found</span>
          </div>
        ) : (
          filteredSortedCustomers.map((cust) => {
            const active = selectedCustomerId === cust.id;
            return (
              <button
                key={cust.id}
                type="button"
                aria-pressed={active}
                className={`relative w-full border-b border-border px-3.5 py-3.5 text-left transition-all duration-150 flex flex-col gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-muted/80 before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:bg-primary'
                    : 'bg-card hover:bg-muted/50'
                }`}
                onClick={() => handleSelectCustomer(cust)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-xs shrink-0 shadow-sm overflow-hidden">
                    {cust.avatarUrl ? (
                      <img src={cust.avatarUrl} alt={cust.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      cust.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  {/* Name & Company */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground text-sm truncate">{cust.name}</span>
                      {cust.unread_count > 0 && (
                        <span className="grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {cust.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs truncate font-medium">{cust.company}</p>
                  </div>
                </div>

                {/* Connected channels & Priority */}
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {Object.keys(cust.conversations).map((ch) => (
                      <span
                        key={ch}
                        className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded"
                        title={`${ch.toUpperCase()} connected`}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  
                  <span className={`pl-1.5 font-bold text-[10px] uppercase tracking-wider ${
                    cust.priority === 'Urgent'
                      ? 'text-red-600 dark:text-red-400'
                      : cust.priority === 'Waiting'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                  }`}>
                    {cust.priority}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

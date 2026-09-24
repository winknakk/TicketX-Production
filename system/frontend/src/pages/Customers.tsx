import { useEffect, useMemo, useState } from 'react';
import { MessageSquare, ShieldCheck, Mail, Phone, Link, FolderKanban, Clock, X, Ticket } from 'lucide-react';
import { DataState, PageHeader, SearchField, StatusBadge } from '../components/ui/Primitives';
import { HandoffStatusBadge } from '../components/common/HandoffStatusBadge';
import { CustomerEventTimeline } from '../components/common/CustomerEventTimeline';
import type { CustomerTimelineEvent } from '../types/domain';
import { useProject } from '../context/ProjectContext';
import { apiFetch } from '../lib/apiFetch';

interface Conversation {
  id: string;
  customer: string;
  channel: string;
  status: string;
  last_message: string;
  handled_by: 'ai' | 'human';
  profile_id?: string | null;
  profile_name?: string | null;
  profile_email?: string | null;
  profile_phone?: string | null;
  company_name?: string | null;
  takeover_status?: string | null;
}

interface CustomersProps {
  conversations: Conversation[];
  onOpenConversation: (conversationId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function Customers({ conversations, onOpenConversation, loading = false, error = null }: CustomersProps) {
  const { activeProjectId } = useProject();
  const [search, setSearch] = useState('');
  const [masterCustomers, setMasterCustomers] = useState<any[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<CustomerTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    rooms: Conversation[];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiFetch(`/api/v1/admin/master-data/customers?projectId=${encodeURIComponent(activeProjectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (data?.customers && Array.isArray(data.customers)) {
          setMasterCustomers(data.customers);
        }
      })
      .catch((err) => console.error('Failed to load master customers:', err));

    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  const customers = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        email?: string | null;
        phone?: string | null;
        company?: string | null;
        rooms: Conversation[];
      }
    >();

    // First seed with registered master data customers
    masterCustomers.forEach((mc) => {
      const key = String(mc.id);
      grouped.set(key, {
        id: key,
        name: mc.contact_name || mc.company_name || `Customer #${mc.id}`,
        email: mc.email,
        phone: mc.phone,
        company: mc.company_name,
        rooms: [],
      });
    });

    // Then merge with conversation rooms
    conversations.forEach((conversation) => {
      const key =
        conversation.profile_id && conversation.profile_id !== 'unknown'
          ? conversation.profile_id
          : conversation.customer;
      const existing = grouped.get(key);
      if (existing) {
        existing.rooms.push(conversation);
        if (!existing.email && conversation.profile_email) existing.email = conversation.profile_email;
        if (!existing.phone && conversation.profile_phone) existing.phone = conversation.profile_phone;
        if (!existing.company && conversation.company_name) existing.company = conversation.company_name;
      } else {
        grouped.set(key, {
          id: key,
          name: conversation.profile_name || conversation.customer || 'Unknown customer',
          email: conversation.profile_email,
          phone: conversation.profile_phone,
          company: conversation.company_name,
          rooms: [conversation],
        });
      }
    });

    return [...grouped.values()].filter((customer) =>
      `${customer.name} ${customer.email || ''} ${customer.phone || ''} ${customer.company || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [conversations, masterCustomers, search]);

  useEffect(() => {
    if (!selectedCustomer) {
      setTimelineEvents([]);
      return;
    }

    let isMounted = true;
    setTimelineLoading(true);

    const customerId = selectedCustomer.id;
    apiFetch(`/api/admin/customers/${encodeURIComponent(customerId)}/timeline?projectId=${encodeURIComponent(activeProjectId)}`)
      .then((r) => (r.ok ? r.json() : { success: false, events: [] }))
      .then((data) => {
        if (!isMounted) return;
        if (data && Array.isArray(data.events)) {
          const mapped: CustomerTimelineEvent[] = data.events.map((ev: any) => ({
            id: ev.id,
            profileId: customerId,
            eventType: ev.eventType || 'CONVERSATION_STARTED',
            title: ev.title,
            description: ev.description,
            timestamp: ev.timestamp,
          }));
          setTimelineEvents(mapped);
        } else {
          setTimelineEvents([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load customer timeline:', err);
        if (isMounted) setTimelineEvents([]);
      })
      .finally(() => {
        if (isMounted) setTimelineLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCustomer, activeProjectId]);

  return (
    <div className="page-scroll space-y-6">
      <PageHeader
        eyebrow="Directory"
        title="Directory & Customer Profiles"
        description="Unified account registry, multi-channel identities, and customer event timelines."
        actions={
          <SearchField
            label="Search profiles"
            placeholder="Search profile name, email, company…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-72"
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main List Column */}
        <div className={`overflow-hidden rounded-xl border border-border bg-card ${selectedCustomer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {loading && conversations.length === 0 ? (
            <DataState kind="loading" title="Loading directory" />
          ) : error && conversations.length === 0 ? (
            <DataState kind="error" title="Directory unavailable" description={error} />
          ) : customers.length === 0 ? (
            <DataState
              kind="empty"
              title={search ? 'No matching profiles' : 'No profiles found'}
              description="Customer profile records are synced with active conversations and system directory."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Customer Profile</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Identities</th>
                    <th className="px-4 py-3">Handoff Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((customer) => {
                    const latest = customer.rooms[0];
                    const isSelected = selectedCustomer?.id === customer.id;
                    const channels = [...new Set(customer.rooms.map((room) => room.channel))];

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/5 font-medium' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                              {customer.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {customer.email || customer.phone || `ID: #${customer.id.slice(0, 8)}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-foreground">
                          {customer.company || 'Personal Account'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {channels.map((channel) => (
                              <StatusBadge key={channel} tone="information">
                                {channel}
                              </StatusBadge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <HandoffStatusBadge
                            status={
                              latest.takeover_status === 'PENDING_HUMAN'
                                ? 'PENDING_HUMAN'
                                : latest.handled_by === 'human'
                                ? 'ACTIVE_HUMAN'
                                : 'AI_ACTIVE'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenConversation(latest.id);
                            }}
                            className="touch-target inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 transition cursor-pointer"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Open Room
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Customer Canvas Drawer / Panel */}
        {selectedCustomer && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-6 shadow-md animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm">
                  {selectedCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{selectedCustomer.name}</h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    {selectedCustomer.company || 'Personal Account'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Identities Card (1:N Handles) */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Bound Identities (1:N)
              </p>
              <div className="space-y-2">
                {[...new Set(selectedCustomer.rooms.map((r) => r.channel))].map((ch) => (
                  <div
                    key={ch}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Link className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-semibold uppercase">{ch}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Rooms */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active Conversation Rooms ({selectedCustomer.rooms.length})
              </p>
              <div className="space-y-2">
                {selectedCustomer.rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onOpenConversation(room.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/60 text-left transition cursor-pointer"
                  >
                    <div>
                      <p className="font-semibold text-xs text-foreground">Room #{room.id}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {room.last_message || 'No recent message'}
                      </p>
                    </div>
                    <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Customer Event Timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Customer Event Timeline
                </p>
                {timelineLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                    <Clock className="h-3 w-3 animate-spin text-primary" />
                    Loading…
                  </span>
                )}
              </div>
              <CustomerEventTimeline events={timelineEvents} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { apiFetch } from '../lib/apiFetch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  MessageSquare,
  Ticket,
  Users,
  Search,
  ChevronDown,
  RefreshCw,
  Bell,
  Sparkles,
  Bot,
  UserCheck,
  Zap,
  Shield,
  ShieldCheck,
  HeartPulse,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { getOperatorProfile } from '../lib/operator';

interface ConversationRecord {
  id: string;
  customer?: string;
  profile_name?: string | null;
  profile_email?: string | null;
  profile_phone?: string | null;
  last_message?: string;
  last_message_timestamp?: string | null;
  handled_by: 'ai' | 'human';
  takeover_status?: string | null;
  channel?: string;
  company_name?: string;
}

interface TicketRecord {
  id?: string;
  ticketId?: string;
  status?: string;
  priority?: string;
  severity?: string;
}

interface Metrics {
  slaViolations?: number;
  failedTraces?: number;
}

interface DashboardProps {
  apiBaseUrl: string;
  conversations: ConversationRecord[];
  conversationsLoading?: boolean;
  conversationsError?: string | null;
  conversationsUpdatedAt?: Date | null;
  backendHealthy?: boolean | null;
  refreshConversations?: () => Promise<void> | void;
  onNavigate?: (destination: 'conversations' | 'tickets' | 'traces' | 'directory' | 'dashboard' | 'analytics') => void;
}

type OperationsCategory = 'all' | 'automation' | 'verification' | 'handoff';

export function Dashboard({
  apiBaseUrl,
  conversations,
  conversationsLoading = false,
  conversationsError = null,
  conversationsUpdatedAt = null,
  backendHealthy = null,
  refreshConversations,
  onNavigate,
}: DashboardProps) {
  const { activeProjectId, projects } = useProject();
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const operator = getOperatorProfile(activeProjectId);
  const userRole = localStorage.getItem('user_role') || 'admin';

  const [opsFilter, setOpsFilter] = useState<OperationsCategory>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [metricsRes, ticketsRes] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/v1/admin/metrics?tenantId=${encodeURIComponent(activeProjectId)}`).then((r) =>
            r.ok ? r.json() : null
          ),
          fetch(`${apiBaseUrl}/api/admin/tickets?projectId=${encodeURIComponent(activeProjectId)}`).then((r) =>
            r.ok ? r.json() : []
          ),
        ]);
        if (!isMounted) return;
        if (metricsRes.status === 'fulfilled' && metricsRes.value) {
          setMetrics(metricsRes.value);
        }
        if (ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value)) {
          setTickets(ticketsRes.value);
        }
      } catch (e) {
        console.error('Failed to load project metrics:', e);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeProjectId, apiBaseUrl]);

  const handoffs = useMemo(
    () => conversations.filter((conversation) => conversation.takeover_status === 'PENDING_HUMAN'),
    [conversations]
  );
  const myClaimedRooms = useMemo(
    () => conversations.filter((conversation) => conversation.handled_by === 'human'),
    [conversations]
  );
  const waitingCustomersCount = useMemo(
    () => conversations.filter((c) => c.handled_by === 'ai' || c.takeover_status === 'PENDING_HUMAN').length,
    [conversations]
  );
  const openTicketsCount = useMemo(
    () => tickets.filter((t) => !/resolved|closed/i.test(t.status || '')).length,
    [tickets]
  );
  const urgentTicketsCount = useMemo(
    () => tickets.filter((t) => /high|critical|urgent/i.test(t.priority || t.severity || '')).length,
    [tickets]
  );

  const topPriorityHandoff = handoffs[0];

  const handleClaim = useCallback(
    async (id: string) => {
      setClaimingId(id);
      try {
        await apiFetch(`${apiBaseUrl}/api/v1/conversations/${id}/takeover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorName: operator.name }),
        });
        await refreshConversations?.();
        onNavigate?.('conversations');
      } catch (err) {
        console.error('Takeover failed:', err);
      } finally {
        setClaimingId(null);
      }
    },
    [apiBaseUrl, onNavigate, operator.name, refreshConversations]
  );

  const liveOperationsEvents = useMemo(() => {
    const events = [
      {
        id: 'op-1',
        category: 'verification' as OperationsCategory,
        text: 'AI verified ownership for ACME billing case',
        timestamp: '2m ago',
      },
      {
        id: 'op-2',
        category: 'automation' as OperationsCategory,
        text: 'Automation paused Stripe sync retry',
        timestamp: '5m ago',
      },
      {
        id: 'op-3',
        category: 'handoff' as OperationsCategory,
        text: `Human handoff claimed by ${operator.name}`,
        timestamp: '9m ago',
      },
      {
        id: 'op-4',
        category: 'automation' as OperationsCategory,
        text: 'Infrastructure check passed for LINE gateway',
        timestamp: '12m ago',
      },
    ];

    if (opsFilter === 'all') return events;
    return events.filter((ev) => ev.category === opsFilter);
  }, [opsFilter, operator.name]);

  const recentlyOpenedList = useMemo(() => {
    const list: string[] = [];
    for (const c of conversations) {
      const name = c.company_name || c.profile_name || c.customer;
      if (name && !list.includes(name)) list.push(name);
      if (list.length >= 3) break;
    }
    return list.length ? list : ['Avalant Co.,Ltd.', 'Demo Co.'];
  }, [conversations]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. TOP SECTION GRID */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        {/* Left Hero Card */}
        <div className="lg:col-span-2 bg-card text-card-foreground rounded-2xl border border-border p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xs">
          <div className="space-y-4">
            {/* Title & Body */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {topPriorityHandoff ? `Action: Room #${topPriorityHandoff.id}` : `Welcome, ${operator.name}`}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {topPriorityHandoff
                  ? `Customer "${topPriorityHandoff.profile_name || topPriorityHandoff.customer || 'Customer'}" is waiting for human assistance: "${topPriorityHandoff.last_message || 'No preview available'}"`
                  : 'Enterprise customer is blocked from billing portal. Escalation requested. Ownership verification is the next safe action before sending recovery steps.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Quick Links Panel */}
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 flex flex-col justify-between space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Quick Links</h2>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <button
              onClick={() => onNavigate?.('conversations')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-muted/60 text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span>Inbox</span>
            </button>

            <button
              onClick={() => onNavigate?.('tickets')}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-muted/60 text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer"
            >
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <span>Ticket</span>
            </button>

            <button
              onClick={() => onNavigate?.('directory')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-muted/60 text-xs font-semibold text-foreground transition shadow-2xs cursor-pointer"
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Customer Directory</span>
            </button>

            {userRole === 'super_admin' && (
              <button
                onClick={() => onNavigate?.('center-iam' as any)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-purple-500/30 hover:border-purple-500 bg-purple-500/5 hover:bg-purple-500/10 text-xs font-semibold text-purple-600 dark:text-purple-400 transition shadow-2xs cursor-pointer"
              >
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>Center IAM Console</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. MIDDLE SECTION GRID */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        {/* Left Box: My Work */}
        <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-foreground tracking-tight">My Work</h2>

          <ul className="space-y-3 text-xs text-muted-foreground">
            <li
              onClick={() => onNavigate?.('conversations')}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted transition cursor-pointer"
            >
              <span>Assigned conversations</span>
              <span className="font-semibold text-foreground">{myClaimedRooms.length} · oldest {myClaimedRooms.length ? '4m' : '0m'}</span>
            </li>
            <li
              onClick={() => onNavigate?.('tickets')}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted transition cursor-pointer"
            >
              <span>Assigned tickets</span>
              <span className="font-semibold text-foreground">{openTicketsCount} · {urgentTicketsCount} urgent</span>
            </li>
            <li
              onClick={() => onNavigate?.('conversations')}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted transition cursor-pointer"
            >
              <span>Draft replies</span>
              <span className="font-semibold text-foreground">{handoffs.length} · review before send</span>
            </li>
            <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40">
              <span className="shrink-0">Recently opened</span>
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                {recentlyOpenedList.map((comp) => (
                  <button
                    key={comp}
                    onClick={() => onNavigate?.('conversations')}
                    title={`Open conversations for ${comp}`}
                    className="px-2 py-0.5 rounded-md bg-card border border-border text-foreground font-semibold hover:bg-muted transition text-[11px] cursor-pointer truncate max-w-[130px]"
                  >
                    {comp}
                  </button>
                ))}
              </div>
            </li>
          </ul>
        </div>

        {/* Right Box: Priority Queues */}
        <div className="lg:col-span-2 bg-card text-card-foreground rounded-2xl border border-border p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Priority Queues</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1 */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Human Takeover</p>
                <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1">{handoffs.length}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Worst wait {handoffs.length ? '14m' : '0m'}</p>
              </div>
              <button
                onClick={() => onNavigate?.('conversations')}
                className="w-full py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Open
              </button>
            </div>

            {/* Card 2 */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Waiting Customers</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{waitingCustomersCount}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Worst wait {waitingCustomersCount ? '18m' : '0m'}</p>
              </div>
              <button
                onClick={() => onNavigate?.('conversations')}
                className="w-full py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Open
              </button>
            </div>

            {/* Card 3 */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">SLA Risks</p>
                <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1">{metrics?.slaViolations ?? urgentTicketsCount}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Worst wait {urgentTicketsCount ? '9m' : '0m'}</p>
              </div>
              <button
                onClick={() => onNavigate?.('tickets')}
                className="w-full py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Open
              </button>
            </div>

            {/* Card 4 */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border flex flex-col justify-between space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Workflow Errors</p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{metrics?.failedTraces ?? 0}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Worst wait {metrics?.failedTraces ? '7m' : '0m'}</p>
              </div>
              <button
                onClick={() => onNavigate?.('traces')}
                className="w-full py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SECTION: LIVE OPERATIONS */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Live Operations</h2>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1">
            {(['all', 'automation', 'verification', 'handoff'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setOpsFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition cursor-pointer ${
                  opsFilter === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Operational Log Feed */}
        <div className="space-y-2 pt-2">
          {liveOperationsEvents.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border text-xs text-foreground"
            >
              <span>{ev.text}</span>
              <span className="text-muted-foreground font-medium">{ev.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

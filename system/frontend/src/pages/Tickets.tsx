import { apiFetch } from '../lib/apiFetch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button, DataState, IconButton, LastUpdated, PageHeader, SearchField, StatusBadge } from '../components/ui/Primitives';
import { matchesFilter, statusLabel, statusTone, type StatusFilter } from '../lib/ticketStatus';

interface TicketRecord {
  id1?: string;
  id?: string;
  ticketId?: string;
  ticket_id?: string;
  conversation_id?: string;
  subject?: string;
  summary?: string;
  status?: string;
  priority?: string;
  severity?: string;
  created_by_type?: string;
  createdByType?: string;
  created_by_name?: string;
  createdByName?: string;
  cancellation_reason?: string;
  cancellationReason?: string;
  planeIssueId?: string | null;
  plane_issue_id?: string | null;
  dueDate?: string;
  due_date?: string;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface TicketsProps {
  apiBaseUrl: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const idOf = (ticket: TicketRecord) => ticket.id1 || ticket.id || '';
const displayIdOf = (ticket: TicketRecord) => ticket.ticketId || ticket.ticket_id || idOf(ticket) || 'Unavailable';
const planeIdOf = (ticket: TicketRecord) => ticket.planeIssueId || ticket.plane_issue_id;

// Substring matching on the old free-text status is gone: it treated
// RESOLVED as finished, which hid the tickets that are actually waiting on a
// customer reply. Tone now comes from the lifecycle vocabulary.

const priorityTone = (value?: string): 'escalated' | 'warning' | 'information' | 'neutral' | 'unavailable' => {
  if (!value) return 'unavailable';
  if (/critical|p1|urgent/i.test(value)) return 'escalated';
  if (/high|p2/i.test(value)) return 'warning';
  if (/medium|p3/i.test(value)) return 'information';
  return 'neutral';
};

const renderCreatorBadge = (ticket: TicketRecord) => {
  const rawType = (ticket.created_by_type || ticket.createdByType || (ticket as any).createdBy || 'CUSTOMER').toUpperCase();
  const name = ticket.created_by_name || ticket.createdByName;

  switch (rawType) {
    case 'AI_BOT':
      return <StatusBadge tone="information">ðŸ¤– AI Bot</StatusBadge>;
    case 'HUMAN_AGENT':
    case 'AGENT':
      return <StatusBadge tone="claimed">ðŸŽ§ {name || 'Agent'}</StatusBadge>;
    case 'PLANE_IO':
    case 'PLANE':
      return <StatusBadge tone="warning">âœˆï¸ {name || 'Plane.io'}</StatusBadge>;
    case 'CUSTOMER':
    default:
      return <StatusBadge tone="neutral">ðŸ‘¤ {name || 'Customer'}</StatusBadge>;
  }
};

export function Tickets({ apiBaseUrl, showToast }: TicketsProps) {
  const { activeProjectId } = useProject();
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TicketRecord | null>(null);

  // Cancellation Modal State
  const [cancelModalTicket, setCancelModalTicket] = useState<TicketRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/admin/tickets?projectId=${encodeURIComponent(activeProjectId)}`);
      if (!response.ok) throw new Error(`Ticket service returned ${response.status}`);
      setTickets((await response.json()) || []);
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tickets are unavailable');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, apiBaseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const promote = async (ticket: TicketRecord) => {
    const id = idOf(ticket);
    if (!id) {
      showToast('This record has no promotable database ID.', 'error');
      return;
    }
    setPromotingId(id);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/admin/tickets/${encodeURIComponent(id)}/promote?projectId=${encodeURIComponent(activeProjectId)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
      );
      if (!response.ok) throw new Error(`Promotion returned ${response.status}`);
      const result = await response.json();
      showToast(result.plane_issue_id ? `Promoted to Plane. Issue ID: ${result.plane_issue_id}` : 'Promotion completed.');
      await load();
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Ticket promotion failed', 'error');
    } finally {
      setPromotingId(null);
    }
  };

  const handleCancelTicket = async () => {
    if (!cancelModalTicket) return;
    const ticketId = idOf(cancelModalTicket) || displayIdOf(cancelModalTicket);
    if (!cancelReason.trim() || cancelReason.trim().length < 10) {
      showToast('Please enter a cancellation reason (at least 10 characters).', 'error');
      return;
    }

    setCancelling(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/v1/internal/tickets/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          cancellation_reason: cancelReason.trim(),
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.message || `Server returned ${response.status}`);
      }

      showToast(`Ticket #${ticketId} cancelled successfully.`);
      setCancelModalTicket(null);
      setCancelReason('');
      setConfirmInput('');
      setSelected(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cancellation failed', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const restoreTicket = async (ticket: TicketRecord) => {
    const ticketId = idOf(ticket) || displayIdOf(ticket);
    setRestoringId(ticketId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/v1/internal/tickets/${encodeURIComponent(ticketId)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error(`Restore returned ${response.status}`);
      showToast(`Ticket #${ticketId} restored to Open state.`);
      setSelected(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Ticket restore failed', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const filtered = useMemo(() => {
    return tickets.filter((ticket) => {
      const filterMatches = matchesFilter(ticket.status, filter);
      const text = `${displayIdOf(ticket)} ${ticket.subject || ''} ${ticket.summary || ''} ${ticket.conversation_id || ''} ${ticket.created_by_name || ''}`.toLowerCase();
      return filterMatches && text.includes(search.toLowerCase());
    });
  }, [filter, search, tickets]);

  return (
    <div className="page-scroll space-y-5">
      <PageHeader
        eyebrow="Case management"
        title="Tickets"
        description="Live ticket records for the active project with creator attribution and cancellation safeguards."
        actions={
          <>
            <LastUpdated value={updatedAt} stale={!!error} />
            <Button variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField
          label="Search tickets"
          placeholder="Search ID, subject, creator, or roomâ€¦"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full lg:max-w-md"
        />
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="group" aria-label="Ticket status filter">
          {(['all', 'open', 'waiting', 'resolved', 'closed', 'cancelled'] as const).map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              className={`touch-target shrink-0 rounded-md px-3 text-xs font-semibold capitalize ${filter === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
            >
              {item}
              <span className="ml-1.5">
                {item === 'all'
                  ? tickets.length
                  : tickets.filter((t) => matchesFilter(t.status, item)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading && tickets.length === 0 ? (
          <DataState kind="loading" title="Loading tickets" />
        ) : error && tickets.length === 0 ? (
          <DataState kind="error" title="Tickets unavailable" description={error} actionLabel="Retry" onAction={load} />
        ) : filtered.length === 0 ? (
          <DataState kind="empty" title={search || filter !== 'all' ? 'No matching tickets' : 'No tickets reported'} description="No records found." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">Conversation</th>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Plane Integration</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((ticket, index) => (
                    <tr key={idOf(ticket) || displayIdOf(ticket) || index} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{displayIdOf(ticket)}</td>
                      <td className="px-4 py-3">{renderCreatorBadge(ticket)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{ticket.conversation_id ? `#${ticket.conversation_id}` : 'Unavailable'}</td>
                      <td className="max-w-md px-4 py-3">
                        <p className="font-semibold">{ticket.subject || 'Untitled ticket'}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{ticket.summary || 'No summary reported'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={priorityTone(ticket.priority || ticket.severity)}>
                          {ticket.priority || ticket.severity || 'Unavailable'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {planeIdOf(ticket) ? (
                          <StatusBadge tone="success">Plane · {planeIdOf(ticket)}</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Not promoted</StatusBadge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" className="h-10 min-h-10 px-3" onClick={() => setSelected(ticket)}>
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border lg:hidden">
              {filtered.map((ticket, index) => (
                <article key={idOf(ticket) || displayIdOf(ticket) || index} className="p-4">
                  <button type="button" className="w-full text-left" onClick={() => setSelected(ticket)}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono text-xs font-semibold text-primary">{displayIdOf(ticket)}</span>
                      <StatusBadge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</StatusBadge>
                    </div>
                    <h2 className="mt-2 text-sm font-bold">{ticket.subject || 'Untitled ticket'}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ticket.summary || 'No summary reported'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {renderCreatorBadge(ticket)}
                      <StatusBadge tone={priorityTone(ticket.priority || ticket.severity)}>
                        {ticket.priority || ticket.severity || 'Priority unavailable'}
                      </StatusBadge>
                      {planeIdOf(ticket) && <StatusBadge tone="success">Plane linked</StatusBadge>}
                    </div>
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Ticket Details Inspection Drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-detail-title"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Ticket details</p>
                <h2 id="ticket-detail-title" className="mt-1 font-mono text-lg font-bold">
                  {displayIdOf(selected)}
                </h2>
              </div>
              <IconButton label="Close ticket details" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {renderCreatorBadge(selected)}
              <StatusBadge tone={statusTone(selected.status)}>{selected.status || 'Status unavailable'}</StatusBadge>
              <StatusBadge tone={priorityTone(selected.priority || selected.severity)}>
                {selected.priority || selected.severity || 'Priority unavailable'}
              </StatusBadge>
            </div>

            <section className="mt-6">
              <h3 className="text-base font-bold">{selected.subject || 'Untitled ticket'}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {selected.summary || 'No summary was reported.'}
              </p>
            </section>

            {(selected.cancellation_reason || selected.cancellationReason) && (
              <section className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs font-bold text-red-400">Cancellation Reason</p>
                <p className="mt-1 text-sm text-red-200">{selected.cancellation_reason || selected.cancellationReason}</p>
              </section>
            )}

            <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
              {[
                ['Creator', selected.created_by_name ? `${selected.created_by_type || 'CUSTOMER'} (${selected.created_by_name})` : selected.created_by_type || 'CUSTOMER'],
                ['Conversation', selected.conversation_id ? `#${selected.conversation_id}` : 'Unavailable'],
                ['Created', selected.createdAt || selected.created_at ? new Date((selected.createdAt || selected.created_at) as string).toLocaleString() : 'Unavailable'],
                ['SLA due', selected.dueDate || selected.due_date ? new Date((selected.dueDate || selected.due_date) as string).toLocaleString() : 'Unavailable'],
              ].map(([term, value]) => (
                <div key={term} className="grid grid-cols-[7rem_1fr] gap-3 p-3 text-sm">
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[7rem_1fr] gap-3 p-3 text-sm">
                <dt className="text-muted-foreground">Plane issue</dt>
                <dd className="text-right font-semibold">
                  {planeIdOf(selected) ? (
                    (() => {
                      const planeId = planeIdOf(selected);
                      const planeWs = selected.plane_workspace_slug || selected.planeWorkspaceSlug || 'cs-team';
                      const planeProj = selected.plane_project_id || selected.planeProjectId || (selected.project_id === 101 ? 'e3454524-961a-4b84-8ccb-71575baaa696' : '09aa9c0e-8448-426f-8128-306c3dcf9d78');
                      const planeUrl = `https://projects.oneweb.tech/${planeWs}/projects/${planeProj}/issues/${planeId}`;
                      return (
                        <a href={planeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                          {planeId} ↗
                        </a>
                      );
                    })()
                  ) : (
                    'Not promoted'
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-6 space-y-3">
              {!planeIdOf(selected) && (
                <Button className="w-full" onClick={() => promote(selected)} disabled={!idOf(selected) || promotingId === idOf(selected)}>
                  <ExternalLink className="h-4 w-4" />
                  {promotingId === idOf(selected) ? 'Promotingâ€¦' : idOf(selected) ? 'Promote to Plane' : 'Promotion unavailable'}
                </Button>
              )}

              {(selected.status || '').toLowerCase().includes('cancel') ? (
                <Button
                  variant="secondary"
                  className="w-full text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() => restoreTicket(selected)}
                  disabled={restoringId === displayIdOf(selected)}
                >
                  <RotateCcw className="h-4 w-4" />
                  {restoringId === displayIdOf(selected) ? 'Restoringâ€¦' : 'Restore Ticket to Open'}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setCancelModalTicket(selected)}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Cancel Ticket with Safeguard
                </Button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Double Confirmation Modal for Ticket Cancellation */}
      {cancelModalTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold">Confirm Ticket Cancellation Safeguard</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              You are about to cancel ticket <span className="font-mono font-bold text-foreground">#{displayIdOf(cancelModalTicket)}</span> ({cancelModalTicket.subject}).
              This action requires explicit confirmation and a mandatory cancellation reason.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Mandatory Cancellation Reason (Min 10 characters) *
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="e.g. Duplicate report from customer, verified resolved during phone call..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Type <span className="font-mono text-red-400">CONFIRM</span> to confirm
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="CONFIRM"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setCancelModalTicket(null)} disabled={cancelling}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancelTicket}
                disabled={cancelling || confirmInput.trim() !== 'CONFIRM' || cancelReason.trim().length < 10}
              >
                {cancelling ? 'Processing...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Play, RefreshCw, ShieldAlert, SlidersHorizontal, Timer, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../lib/apiFetch';
import { useProject } from '../context/ProjectContext';
import { Button, DataState, LastUpdated, PageHeader, Section, StatusBadge } from '../components/ui/Primitives';

interface SlaCenterProps { apiBaseUrl: string; onNavigate?: (tab: 'tickets') => void; showToast?: (message: string, type?: 'success' | 'error') => void; }

type Priority = 'Urgent' | 'High' | 'Medium' | 'Low' | 'None';
interface BoardRow {
  id: number; ticketNumber: string | null; subject: string | null; status: string; priority: Priority;
  projectId: number | null; projectName: string | null; channel: string | null; handledBy: string;
  createdAt: string; dueAt: string | null; responseDueAt: string | null; firstResponseAt: string | null;
  remainingMs: number | null; fraction: number | null; breached: boolean; atRisk: boolean; responseMet: boolean | null;
  nextCustomerUpdateAt: string | null;
  plane: { issueId: string; workspaceSlug: string | null; projectId: string | null } | null;
}
interface Overview {
  serverNow: string;
  kpis: { open: number; withinSla: number; atRisk: number; breached: number;
    responseMet7d: { met: number; total: number; rate: number } | null;
    resolvedOnTime7d: { met: number; total: number; rate: number } | null; };
  board: BoardRow[];
  policies: { priority: Priority; responseHours: number; resolveHours: number; businessDays: boolean; source: 'project' | 'default';
    devReminder: { every: number; unit: 'hours' | 'businessDays' } | null; customerUpdate: { every: number; unit: 'hours' | 'businessDays' } | null; }[];
  trend: { day: string; onTime: number; late: number }[];
  resolutionByPriority: { priority: string; count: number; avgHours: number }[];
  recent: { kind: string; at: string; ticket_number: string | null; priority: string | null; ref: string; status: string | null }[];
  engine: { enabled: boolean; running: boolean; intervalMs: number; lastRunAt: string | null; nextRunAt: string | null; lastRunError: string | null };
  /** Added by the route: whether this session may use the control panel. */
  viewer?: { canControl: boolean; writesAllowed: boolean };
}

// ---- control panel (super_admin only) ----
interface CadencePhase { phase: string; slot: number; slotKey: string; nextBoundaryAt: string; claimed: boolean; predictedDeliveryAt: string | null; interval: { every: number; unit: string } }
interface Inspect {
  ticket: { id: number; ticketNumber: string | null; subject: string | null; status: string; planeStatus: string | null; priority: Priority; channel: string | null; customerName: string | null; customerRef: string | null; createdAt: string };
  sla: { firstResponseAt: string | null; responseDueAt: string | null; responseMet: boolean | null; dueAt: string | null };
  eligibility: { checks: { key: string; ok: boolean; label: string; detail: string }[] };
  cadence: { dev: CadencePhase | null; user: CadencePhase | null };
}
interface ActionResult { id: number; at: Date; title: string; ok: boolean; lines: string[] }

const PRIORITY_ORDER: Priority[] = ['Urgent', 'High', 'Medium', 'Low', 'None'];
const priorityTone = (p?: string): 'escalated' | 'warning' | 'information' | 'neutral' | 'unavailable' => {
  switch (p) { case 'Urgent': return 'escalated'; case 'High': return 'warning'; case 'Medium': return 'information'; case 'Low': return 'neutral'; default: return 'unavailable'; }
};
const priorityGlyph: Record<string, string> = { Urgent: '🔴', High: '🟠', Medium: '🟡', Low: '🟢', None: '⚪' };

const two = (n: number) => String(n).padStart(2, '0');
const fmtBkk = (v?: string | null, withDate = true) => {
  if (!v) return '—';
  const d = new Date(v); if (Number.isNaN(d.getTime())) return '—';
  const b = new Date(d.getTime() + 7 * 3_600_000);
  const time = `${two(b.getUTCHours())}:${two(b.getUTCMinutes())}`;
  return withDate ? `${b.getUTCDate()}/${b.getUTCMonth() + 1} ${time}` : time;
};
const fmtDuration = (ms: number | null) => {
  if (ms === null || Number.isNaN(ms)) return '—';
  const neg = ms < 0; const s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const body = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${two(m)}m` : `${m}m ${two(s % 60)}s`;
  return neg ? `${body} over` : body;
};
const hoursLabel = (hours: number, businessDays: boolean) => {
  if (hours >= 999) return 'No target';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (businessDays && hours >= 24) return `${Math.round(hours / 24)} business day${hours >= 48 ? 's' : ''}`;
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24} day${hours > 24 ? 's' : ''}`;
  return `${hours} h`;
};
const intervalLabel = (i: { every: number; unit: string } | null) => !i ? 'On demand' : i.unit === 'hours' ? `every ${i.every} h` : `every ${i.every} business day${i.every > 1 ? 's' : ''}`;
const FEED_LABEL: Record<string, string> = {
  dev_reminder: 'Dev reminder', customer_update: 'Customer update (LINE)', urgent_email: 'Urgent alert → Dev', done_email: 'Done email → customer', reminder_email: 'Reminder email → Dev',
};
const PHASE_LABEL: Record<string, string> = { due_now: 'due on the next pass', slot_sent: 'this slot already sent', missed_boundary: 'boundary missed (outside catch-up grace)', waiting_first_boundary: 'waiting for the first boundary' };
const REASON_LABEL: Record<string, string> = {
  TICKET_NOT_FOUND: 'Ticket not found', MINUTES_OUT_OF_RANGE: 'Minutes must be between 1 and 1440', WEBHOOK_NOT_CONFIGURED: 'SLA_NOTIFICATION_FLOW_WEBHOOK_URL is not configured',
  NO_DEV_RECIPIENT: 'No developer email for this project', NO_CONVERSATION: 'Ticket has no conversation', HUMAN_OWNS_THREAD: 'A human agent owns this conversation, so the AI does not message the customer',
  NOT_LINE: 'Customer is not on LINE', NO_CHANGE: 'Already in that state, nothing sent', INVALID_TRANSITION: 'That status change is not allowed from the current status', SUPER_ADMIN_REQUIRED: 'super_admin session required', DB_ERROR: 'Database error',
};

/** Turns a console API response into readable result lines. */
function describeResult(title: string, body: any): ActionResult {
  const d = body?.data ?? {};
  const ok = body?.success === true && d.ok !== false;
  const lines: string[] = [];
  if (!ok) {
    const reason = d.reason || body?.code || null;
    lines.push(REASON_LABEL[reason] || body?.error || reason || 'Request failed');
    if (d.detail) lines.push(String(d.detail));
    if (d.error) lines.push(String(d.error));
  } else if ('evaluated' in d) {
    if (d.alreadyRunning) lines.push('A pass is already running, nothing started');
    else if (d.skippedLocked) lines.push('Skipped: another runner holds the lock');
    else {
      lines.push(`${d.dryRun ? 'Dry run: ' : ''}${d.evaluated} open ticket${d.evaluated === 1 ? '' : 's'} evaluated`);
      lines.push(`Dev reminders ${d.dryRun ? 'that would send' : 'sent'}: ${d.devAlertsSent} · customer updates: ${d.userUpdatesSent}`);
      if (d.awaitingEvaluated) lines.push(`Awaiting-confirmation tickets: ${d.awaitingEvaluated} · nudges ${d.nudgesSent} · auto-closed ${d.autoClosed}`);
    }
  } else if ('kind' in d && 'sent' in d) {
    lines.push(d.sent ? `${d.kind === 'dev' ? 'Developer reminder email' : 'Customer LINE update'} sent for ${d.ticketNumber || 'ticket'}` : `Not sent (${d.reason || 'slot already used'})`);
    if (d.key) lines.push(`slot ${d.key}`);
  } else if ('notified' in d) {
    lines.push(`${d.ticket?.ticket_number || 'Ticket'}: ${d.previousStatus} → ${d.ticket?.status}`);
    lines.push(d.notified ? 'Customer received the "please test the fix" LINE message with confirm chips' : `Customer not messaged${d.notifyError ? ': ' + d.notifyError : ''}`);
    lines.push('Plane card follows through the outbox within about 10 s when the ticket is linked');
  } else if ('previousStatus' in d) {
    lines.push(`${d.ticket?.ticket_number || 'Ticket'}: ${d.previousStatus} → ${d.ticket?.status} (no customer message)`);
  } else if ('minutes' in d) {
    lines.push(`Clock shifted back ${d.minutes} min · created ${fmtBkk(d.after?.created_at)} · due ${fmtBkk(d.after?.due_date)}`);
  } else if ('deleted' in d) {
    const c = d.deleted;
    lines.push(c && typeof c === 'object' ? Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Test data cleared');
  } else lines.push('Done');
  return { id: Date.now() + Math.random(), at: new Date(), title, ok, lines };
}

export function SlaCenter({ apiBaseUrl, onNavigate, showToast }: SlaCenterProps) {
  const { activeProjectId } = useProject();
  const isSuperAdmin = (localStorage.getItem('user_role') || '') === 'super_admin';
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  // control panel
  const [controlRef, setControlRef] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shiftMinutes, setShiftMinutes] = useState(61);
  const [results, setResults] = useState<ActionResult[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/v1/admin/sla/overview?projectId=${encodeURIComponent(activeProjectId)}`);
      if (!response.ok) throw new Error(`SLA service returned ${response.status}`);
      const body = await response.json();
      const next: Overview = body.data ?? body;
      setData(next);
      setOffsetMs(new Date(next.serverNow).getTime() - Date.now());
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'SLA overview is unavailable');
    } finally { setLoading(false); }
  }, [activeProjectId, apiBaseUrl]);

  const loadInspect = useCallback(async (ref: string) => {
    setInspectError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/v1/admin/sla/tickets/${encodeURIComponent(ref)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || `Ticket inspection returned ${response.status}`);
      setInspect(body.data ?? body);
    } catch (reason) { setInspectError(reason instanceof Error ? reason.message : 'Ticket inspection failed'); }
  }, [apiBaseUrl]);

  /** Runs one control action, records a readable result, and refreshes the board. */
  const act = useCallback(async (key: string, title: string, path: string, payload: Record<string, unknown>) => {
    if (busy) return;
    setBusy(key);
    try {
      const response = await apiFetch(`${apiBaseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true, ...payload }) });
      const body = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }));
      const result = describeResult(title, body);
      setResults((prev) => [result, ...prev].slice(0, 30));
      showToast?.(`${title}: ${result.lines[0]}`, result.ok ? 'success' : 'error');
      await load();
      if (controlRef) await loadInspect(controlRef);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Request failed';
      setResults((prev) => [{ id: Date.now(), at: new Date(), title, ok: false, lines: [message] }, ...prev].slice(0, 30));
      showToast?.(`${title}: ${message}`, 'error');
    } finally { setBusy(null); }
  }, [apiBaseUrl, busy, controlRef, load, loadInspect, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (controlRef) { setInspect(null); loadInspect(controlRef); } }, [controlRef, loadInspect]);
  const serverNow = now + offsetMs;

  const board = useMemo(() => {
    if (!data) return [];
    return data.board
      .filter((r) => priorityFilter === 'all' || r.priority === priorityFilter)
      .map((r) => {
        const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
        const created = new Date(r.createdAt).getTime();
        const remaining = due !== null ? due - serverNow : null;
        const fraction = due !== null && due > created ? Math.max(0, Math.min(1, (due - serverNow) / (due - created))) : null;
        return { ...r, liveRemaining: remaining, liveFraction: fraction, liveBreached: remaining !== null && remaining < 0 };
      });
  }, [data, priorityFilter, serverNow]);

  if (loading && !data) return <div className="page-scroll"><DataState kind="loading" title="Loading SLA Center" /></div>;
  if (error && !data) return <div className="page-scroll"><PageHeader eyebrow="Insights" title="SLA Center" description="Service-level health for the active workspace." /><DataState kind="error" title="SLA Center unavailable" description={error} actionLabel="Retry" onAction={load} /></div>;
  if (!data) return null;

  const { kpis, engine } = data;
  const canControl = isSuperAdmin && data.viewer?.canControl === true;
  const writesAllowed = data.viewer?.writesAllowed !== false;
  const pct = (v: { met: number; total: number; rate: number } | null) => v ? `${Math.round(v.rate * 100)}%` : '—';
  const tiles = [
    { label: 'Open within SLA', value: kpis.withinSla, detail: `${kpis.open} open ticket${kpis.open === 1 ? '' : 's'} in scope`, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'At risk (< 25% time left)', value: kpis.atRisk, detail: 'Resolution target approaching', icon: Timer, tone: kpis.atRisk ? 'text-amber-600 dark:text-amber-400' : '' },
    { label: 'Breached', value: kpis.breached, detail: 'Past the resolution target', icon: ShieldAlert, tone: kpis.breached ? 'text-red-600 dark:text-red-400' : '' },
    { label: 'Met in the last 7 days', value: `${pct(kpis.resolvedOnTime7d)} · ${pct(kpis.responseMet7d)}`, detail: `resolved on time (${kpis.resolvedOnTime7d?.met ?? 0}/${kpis.resolvedOnTime7d?.total ?? 0}) · first response (${kpis.responseMet7d?.met ?? 0}/${kpis.responseMet7d?.total ?? 0})`, icon: Clock3, tone: '' },
  ];
  const engineTone = !engine.enabled ? 'unavailable' : engine.lastRunError ? 'error' : engine.running ? 'success' : 'warning';
  const engineText = !engine.enabled ? 'Cadence engine disabled' : engine.lastRunError ? 'Cadence engine error' : engine.running ? 'Cadence engine running' : 'Cadence engine stopped';
  const ticketPath = (action: string) => `/api/v1/admin/sla/tickets/${encodeURIComponent(controlRef || '')}/${action}`;
  const rowRef = (r: BoardRow) => r.ticketNumber || String(r.id);

  return (
    <div className="page-scroll space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="SLA Center"
        description={`Live service-level health for the active workspace: what is about to breach, how the last 7 days went, and whether the reminder engine is doing its job. ${canControl ? 'Controls are enabled for this super_admin session.' : 'Read-only for this role.'}`}
        actions={<><LastUpdated value={updatedAt} stale={!!error} /><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, detail, icon: Icon, tone }) => (
          <Section key={label}>
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div>
            <p className={`metric-value mt-4 text-3xl font-bold ${tone}`}>{value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
          </Section>
        ))}
      </div>

      <Section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">SLA clock</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open tickets ordered by time left to the resolution target. Countdowns are live.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', ...PRIORITY_ORDER] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPriorityFilter(p)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${priorityFilter === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}>
                {p === 'all' ? 'All' : `${priorityGlyph[p]} ${p}`}
              </button>
            ))}
          </div>
        </div>
        {board.length === 0 ? <DataState compact kind="empty" title="No open tickets in scope" description="Nothing is waiting on a resolution target right now." /> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th>Ticket</th><th>Status</th><th>First response</th><th>Time to resolution</th><th>Next customer update</th><th>Owner</th><th className="text-right">{canControl ? 'Links · Control' : 'Links'}</th></tr></thead>
              <tbody>
                {board.map((r) => {
                  const barTone = r.liveBreached ? 'bg-red-500' : (r.liveFraction ?? 1) < 0.25 ? 'bg-amber-500' : 'bg-emerald-500';
                  const width = r.liveFraction === null ? 0 : Math.round(r.liveFraction * 100);
                  const planeLink = r.plane?.workspaceSlug && r.plane?.projectId ? `https://projects.oneweb.tech/${r.plane.workspaceSlug}/projects/${r.plane.projectId}/issues/${r.plane.issueId}` : null;
                  const selected = controlRef === rowRef(r);
                  return (
                    <tr key={r.id} className={selected ? 'bg-primary/5' : ''}>
                      <td>
                        <div className="flex items-center gap-2"><StatusBadge tone={priorityTone(r.priority)}>{priorityGlyph[r.priority]} {r.priority}</StatusBadge><span className="font-semibold">{r.ticketNumber || `#${r.id}`}</span></div>
                        <p className="mt-1 max-w-[28rem] truncate text-xs text-muted-foreground" title={r.subject || ''}>{r.subject || '—'}</p>
                        {r.projectName && <p className="text-[11px] text-muted-foreground">{r.projectName}</p>}
                      </td>
                      <td><StatusBadge tone="neutral">{r.status}</StatusBadge></td>
                      <td>
                        {r.responseMet === null ? <span className="text-xs text-muted-foreground">Due {fmtBkk(r.responseDueAt, false)}</span>
                          : r.responseMet ? <StatusBadge tone="success">Met · {fmtBkk(r.firstResponseAt, false)}</StatusBadge>
                          : <StatusBadge tone="error">Late</StatusBadge>}
                      </td>
                      <td className="min-w-[13rem]">
                        {r.dueAt ? (
                          <>
                            <div className="flex items-center justify-between text-xs"><span className={`font-semibold ${r.liveBreached ? 'text-red-600 dark:text-red-400' : ''}`}>{fmtDuration(r.liveRemaining)}</span><span className="text-muted-foreground">due {fmtBkk(r.dueAt)}</span></div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${barTone}`} style={{ width: `${r.liveBreached ? 100 : width}%` }} /></div>
                          </>
                        ) : <span className="text-xs text-muted-foreground">No target</span>}
                      </td>
                      <td className="text-xs text-muted-foreground">{r.nextCustomerUpdateAt ? fmtBkk(r.nextCustomerUpdateAt) : (r.channel === 'line' ? '—' : 'Not on LINE')}</td>
                      <td>{r.handledBy === 'ai' ? <StatusBadge tone="ai">🤖 AI</StatusBadge> : <StatusBadge tone="human">🎧 Agent</StatusBadge>}</td>
                      <td className="text-right whitespace-nowrap">
                        <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => onNavigate?.('tickets')}>Tickets</button>
                        {planeLink && <a className="ml-3 text-xs font-semibold text-primary hover:underline" href={planeLink} target="_blank" rel="noreferrer">Plane ↗</a>}
                        {canControl && (
                          <button type="button" onClick={() => setControlRef(selected ? null : rowRef(r))}
                            className={`ml-3 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>
                            <SlidersHorizontal className="h-3 w-3" />Control
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {canControl && (
        <Section className="border-primary/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold">Control panel <StatusBadge tone="escalated">super_admin</StatusBadge></h2>
              <p className="mt-1 text-sm text-muted-foreground">Every action runs immediately, is written to the ticket audit trail, and can send real emails or LINE messages. Results appear on the right.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!!busy} onClick={() => act('dry', 'Dry run', '/api/v1/admin/sla/run', { dryRun: true })}><Play className="h-4 w-4" />Dry run</Button>
              <Button disabled={!!busy || !writesAllowed} onClick={() => act('run', 'Run cadence pass now', '/api/v1/admin/sla/run', {})}><Play className="h-4 w-4" />Run now</Button>
            </div>
          </div>
          {!writesAllowed && <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Write actions are disabled on this server (SLA_CONSOLE_ALLOW_WRITES). Dry run still works.</div>}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="surface-inset min-w-0 rounded-xl p-4">
              {!controlRef ? (
                <DataState compact kind="empty" title="No ticket selected" description="Press Control on a row in the SLA clock to inspect it and run actions against it." />
              ) : inspectError ? (
                <DataState compact kind="error" title="Ticket inspection failed" description={inspectError} actionLabel="Retry" onAction={() => loadInspect(controlRef)} />
              ) : !inspect ? (
                <DataState compact kind="loading" title={`Inspecting ${controlRef}`} />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold">{inspect.ticket.ticketNumber || `#${inspect.ticket.id}`}</span>
                      <StatusBadge tone={priorityTone(inspect.ticket.priority)}>{priorityGlyph[inspect.ticket.priority]} {inspect.ticket.priority}</StatusBadge>
                      <StatusBadge tone="neutral">{inspect.ticket.status}</StatusBadge>
                      {inspect.ticket.planeStatus && <StatusBadge tone="information">Plane: {inspect.ticket.planeStatus}</StatusBadge>}
                    </div>
                    <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted" onClick={() => setControlRef(null)} aria-label="Close"><X className="h-4 w-4" /></button>
                  </div>
                  <p className="text-sm">{inspect.ticket.subject || '—'}</p>
                  <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Customer</span> · {inspect.ticket.customerName || '—'} · {inspect.ticket.channel || '?'} {inspect.ticket.customerRef && <code className="rounded bg-muted px-1">{inspect.ticket.customerRef}</code>}</div>
                    <div><span className="text-muted-foreground">Opened</span> · {fmtBkk(inspect.ticket.createdAt)}</div>
                    <div><span className="text-muted-foreground">First response</span> · {inspect.sla.firstResponseAt ? `${fmtBkk(inspect.sla.firstResponseAt, false)} (${inspect.sla.responseMet ? 'met' : 'late'})` : `none · due ${fmtBkk(inspect.sla.responseDueAt, false)}`}</div>
                    <div><span className="text-muted-foreground">Resolution</span> · {inspect.sla.dueAt ? `${fmtDuration(new Date(inspect.sla.dueAt).getTime() - serverNow)} · due ${fmtBkk(inspect.sla.dueAt)}` : 'no target'}</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {([['Developer reminder', inspect.cadence.dev], ['Customer progress report', inspect.cadence.user]] as const).map(([label, c]) => (
                      <div key={label} className="rounded-lg border border-border p-3 text-xs">
                        <p className="font-semibold">{label}</p>
                        {!c ? <p className="mt-1 text-muted-foreground">No automatic cadence for this priority.</p> : (
                          <>
                            <p className="mt-1 text-muted-foreground">{intervalLabel(c.interval)} · slot {c.slot} · {PHASE_LABEL[c.phase] || c.phase}</p>
                            <p className="mt-1">Next boundary {fmtBkk(c.nextBoundaryAt)} · expected send {c.predictedDeliveryAt ? `in ${fmtDuration(new Date(c.predictedDeliveryAt).getTime() - serverNow)}` : 'engine stopped'}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold">Eligibility checks ({inspect.eligibility.checks.filter((c) => c.ok).length}/{inspect.eligibility.checks.length} pass)</summary>
                    <ul className="mt-2 space-y-1">
                      {inspect.eligibility.checks.map((c) => <li key={c.key} className="flex gap-2"><span className={c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{c.ok ? '✓' : '✗'}</span><span>{c.label} <span className="text-muted-foreground">· {c.detail}</span></span></li>)}
                    </ul>
                  </details>

                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" min={1} max={1440} value={shiftMinutes} onChange={(e) => setShiftMinutes(Number(e.target.value) || 61)}
                        className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" aria-label="Minutes to shift" />
                      <span className="text-xs text-muted-foreground">min</span>
                      <Button variant="secondary" disabled={!!busy || !writesAllowed} onClick={() => act('shift', `Shift clock back ${shiftMinutes} min`, ticketPath('shift-clock'), { minutes: shiftMinutes })}>Shift clock back</Button>
                      <Button variant="secondary" disabled={!!busy || !writesAllowed} onClick={() => act('dev', 'Send developer reminder', ticketPath('force'), { kind: 'dev' })}>Send dev email</Button>
                      <Button variant="secondary" disabled={!!busy || !writesAllowed} onClick={() => act('user', 'Send customer LINE update', ticketPath('force'), { kind: 'user' })}>Send LINE update</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button disabled={!!busy || !writesAllowed} onClick={() => act('deliver', 'Deliver to customer', ticketPath('deliver'), {})}>Deliver to customer</Button>
                      <Button variant="danger" disabled={!!busy || !writesAllowed} onClick={() => act('reset', 'Clear test data', ticketPath('reset'), {})}>Clear test data</Button>
                      <Button variant="danger" disabled={!!busy || !writesAllowed} onClick={() => act('cancel', 'Cancel ticket', ticketPath('close'), { mode: 'cancelled' })}>Cancel ticket</Button>
                      <Button variant="danger" disabled={!!busy || !writesAllowed} onClick={() => act('close', 'Close ticket', ticketPath('close'), { mode: 'closed' })}>Close ticket</Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Deliver = RESOLVED + Plane "Delivery to Customer" + LINE "please test" message with confirm chips. Cancel and Close change the status silently. Shift clock rewinds the created and due timestamps (test data only).</p>
                  </div>
                </div>
              )}
            </div>

            <div className="surface-inset min-w-0 rounded-xl p-4">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">Action results</p>{results.length > 0 && <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setResults([])}>Clear</button>}</div>
              {results.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nothing run yet in this session.</p> : (
                <ul className="mt-3 space-y-2">
                  {results.map((r) => (
                    <li key={r.id} className={`rounded-lg border p-3 text-xs ${r.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{r.ok ? '✓' : '✗'} {r.title}</span><span className="text-muted-foreground">{fmtBkk(r.at.toISOString(), false)}</span></div>
                      {r.lines.map((l, i) => <p key={i} className="mt-1 break-words text-muted-foreground">{l}</p>)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section>
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Service-level policy</h2><p className="mt-1 text-sm text-muted-foreground">Targets and reminder cadence applied to this scope.</p></div>
            <StatusBadge tone={data.policies.some((p) => p.source === 'project') ? 'information' : 'neutral'}>{data.policies.some((p) => p.source === 'project') ? 'Project policy' : 'Default matrix'}</StatusBadge>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th>Priority</th><th>Response</th><th>Resolution</th><th>Dev reminder</th><th>Customer update</th></tr></thead>
              <tbody>
                {data.policies.map((p) => (
                  <tr key={p.priority}>
                    <td><StatusBadge tone={priorityTone(p.priority)}>{priorityGlyph[p.priority]} {p.priority}</StatusBadge></td>
                    <td>{hoursLabel(p.responseHours, p.businessDays)}</td>
                    <td>{hoursLabel(p.resolveHours, p.businessDays)}</td>
                    <td className="text-muted-foreground">{intervalLabel(p.devReminder)}</td>
                    <td className="text-muted-foreground">{intervalLabel(p.customerUpdate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">Urgent and High run around the clock. Medium, Low and None count business days (Mon–Fri, Asia/Bangkok); public holidays are not yet modelled.</p>
        </Section>

        <Section>
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Resolved on time · last 14 days</h2><p className="mt-1 text-sm text-muted-foreground">Tickets closed each day, split by whether they met the resolution target.</p></div>
            <StatusBadge tone="information">Evidence</StatusBadge>
          </div>
          {data.trend.every((t) => t.onTime + t.late === 0) ? <DataState compact kind="empty" title="No tickets resolved in the last 14 days" /> : (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend.map((t) => ({ ...t, label: t.day.slice(5).replace('-', '/') }))} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="onTime" name="On time" stackId="a" fill="var(--success)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="late" name="Late" stackId="a" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.resolutionByPriority.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...data.resolutionByPriority].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority as Priority) - PRIORITY_ORDER.indexOf(b.priority as Priority)).map((r) => (
                <div key={r.priority} className="surface-inset p-3">
                  <p className="text-xs text-muted-foreground">{priorityGlyph[r.priority]} {r.priority} · avg resolution</p>
                  <p className="metric-value mt-1 text-xl font-bold">{r.avgHours >= 48 ? `${(r.avgHours / 24).toFixed(1)} d` : `${r.avgHours.toFixed(1)} h`}</p>
                  <p className="text-[11px] text-muted-foreground">{r.count} resolved · 30 days</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold">Recent SLA notifications</h2><p className="mt-1 text-sm text-muted-foreground">What the cadence engine and the Plane notification flow actually sent.</p></div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={engineTone}>{engineText}</StatusBadge>
            <span className="text-xs text-muted-foreground">{engine.running && engine.nextRunAt ? `next pass ${fmtBkk(engine.nextRunAt, false)} · every ${Math.round(engine.intervalMs / 60000)} min` : engine.lastRunAt ? `last pass ${fmtBkk(engine.lastRunAt, false)}` : ''}</span>
          </div>
        </div>
        {engine.lastRunError && <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-all">{engine.lastRunError}</span></div>}
        {data.recent.length === 0 ? <DataState compact kind="empty" title="No SLA notifications yet" description="Reminders and customer updates will appear here as they are sent." /> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th>When</th><th>Notification</th><th>Ticket</th><th>Reference</th><th>Status</th></tr></thead>
              <tbody>
                {data.recent.map((f, i) => (
                  <tr key={`${f.kind}-${f.ref}-${i}`}>
                    <td className="whitespace-nowrap text-muted-foreground">{fmtBkk(f.at)}</td>
                    <td>{FEED_LABEL[f.kind] || f.kind}</td>
                    <td><span className="font-semibold">{f.ticket_number || '—'}</span> {f.priority && <span className="text-xs text-muted-foreground">{priorityGlyph[f.priority] || ''}</span>}</td>
                    <td className="text-xs text-muted-foreground break-all">{f.ref}</td>
                    <td><StatusBadge tone={f.status === 'sent' || f.status === 'processed' ? 'success' : f.status === 'failed' ? 'error' : 'neutral'}>{f.status || '—'}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

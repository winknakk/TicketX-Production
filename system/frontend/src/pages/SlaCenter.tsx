import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Timer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../lib/apiFetch';
import { useProject } from '../context/ProjectContext';
import { Button, DataState, LastUpdated, PageHeader, Section, StatusBadge } from '../components/ui/Primitives';

interface SlaCenterProps { apiBaseUrl: string; onNavigate?: (tab: 'tickets') => void; }

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
}

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

export function SlaCenter({ apiBaseUrl, onNavigate }: SlaCenterProps) {
  const { activeProjectId } = useProject();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');

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

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
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
  const pct = (v: { met: number; total: number; rate: number } | null) => v ? `${Math.round(v.rate * 100)}%` : '—';
  const tiles = [
    { label: 'Open within SLA', value: kpis.withinSla, detail: `${kpis.open} open ticket${kpis.open === 1 ? '' : 's'} in scope`, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'At risk (< 25% time left)', value: kpis.atRisk, detail: 'Resolution target approaching', icon: Timer, tone: kpis.atRisk ? 'text-amber-600 dark:text-amber-400' : '' },
    { label: 'Breached', value: kpis.breached, detail: 'Past the resolution target', icon: ShieldAlert, tone: kpis.breached ? 'text-red-600 dark:text-red-400' : '' },
    { label: 'Met in the last 7 days', value: `${pct(kpis.resolvedOnTime7d)} · ${pct(kpis.responseMet7d)}`, detail: `resolved on time (${kpis.resolvedOnTime7d?.met ?? 0}/${kpis.resolvedOnTime7d?.total ?? 0}) · first response (${kpis.responseMet7d?.met ?? 0}/${kpis.responseMet7d?.total ?? 0})`, icon: Clock3, tone: '' },
  ];
  const engineTone = !engine.enabled ? 'unavailable' : engine.lastRunError ? 'error' : engine.running ? 'success' : 'warning';
  const engineText = !engine.enabled ? 'Cadence engine disabled' : engine.lastRunError ? 'Cadence engine error' : engine.running ? 'Cadence engine running' : 'Cadence engine stopped';

  return (
    <div className="page-scroll space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="SLA Center"
        description="Live service-level health for the active workspace: what is about to breach, how the last 7 days went, and whether the reminder engine is doing its job. Read-only by design."
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
              <thead><tr><th>Ticket</th><th>Status</th><th>First response</th><th>Time to resolution</th><th>Next customer update</th><th>Owner</th><th className="text-right">Links</th></tr></thead>
              <tbody>
                {board.map((r) => {
                  const barTone = r.liveBreached ? 'bg-red-500' : (r.liveFraction ?? 1) < 0.25 ? 'bg-amber-500' : 'bg-emerald-500';
                  const width = r.liveFraction === null ? 0 : Math.round(r.liveFraction * 100);
                  const planeLink = r.plane?.workspaceSlug && r.plane?.projectId ? `https://projects.oneweb.tech/${r.plane.workspaceSlug}/projects/${r.plane.projectId}/issues/${r.plane.issueId}` : null;
                  return (
                    <tr key={r.id}>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

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

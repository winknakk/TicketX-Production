import { apiFetch } from '../lib/apiFetch';
import { useCallback, useEffect, useState } from 'react';
import { Activity, Database, Gauge, RefreshCw, ShieldAlert } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button, DataState, LastUpdated, PageHeader, Section, StatusBadge } from '../components/ui/Primitives';

interface AnalyticsProps { apiBaseUrl: string; }
interface Metrics { totalTraces: number; completedTraces: number; failedTraces: number; averageLatencyMs: number; totalTickets: number; slaViolations: number; slaViolationRate: number; agentRoutingDistribution?: Record<string, number>; queueDepth: number; cacheHits: number; cacheMisses: number; cacheHitRatio: number; pendingHandoffs?: number; claimedHandoffs?: number; }

export function Analytics({ apiBaseUrl }: AnalyticsProps) {
  const { activeProjectId } = useProject();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/v1/admin/metrics?tenantId=${encodeURIComponent(activeProjectId)}`);
      if (!response.ok) throw new Error(`Metrics service returned ${response.status}`);
      setMetrics(await response.json()); setUpdatedAt(new Date());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Metrics are unavailable'); }
    finally { setLoading(false); }
  }, [activeProjectId, apiBaseUrl]);
  useEffect(() => { load(); }, [load]);

  if (loading && !metrics) return <div className="page-scroll"><DataState kind="loading" title="Loading operational analytics" /></div>;
  if (error && !metrics) return <div className="page-scroll"><PageHeader eyebrow="Evidence" title="Operational analytics" description="Only values returned by the metrics API are presented." /><DataState kind="error" title="Analytics unavailable" description={error} actionLabel="Retry" onAction={load} /></div>;

  const items = metrics ? [
    { label: 'Automation traces', value: metrics.totalTraces, detail: `${metrics.completedTraces} completed · ${metrics.failedTraces} failed`, icon: Activity },
    { label: 'Pending handoffs', value: metrics.pendingHandoffs, detail: `${metrics.claimedHandoffs} claimed by agents`, icon: ShieldAlert },
    { label: 'Average trace latency', value: `${metrics.averageLatencyMs.toFixed(0)} ms`, detail: 'Aggregate reported by the metrics service', icon: Gauge },
    { label: 'Cache effectiveness', value: `${(metrics.cacheHitRatio * (metrics.cacheHitRatio <= 1 ? 100 : 1)).toFixed(1)}%`, detail: `${metrics.cacheHits} hits · ${metrics.cacheMisses} misses`, icon: Database },
  ] : [];
  const routing = Object.entries(metrics?.agentRoutingDistribution || {});

  return <div className="page-scroll space-y-6"><PageHeader eyebrow="Evidence" title="Operational analytics" description="A compact view of metrics the backend can currently substantiate; unsupported trends are intentionally omitted." actions={<><LastUpdated value={updatedAt} stale={!!error} /><Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(({ label, value, detail, icon: Icon }) => <Section key={label}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="metric-value mt-4">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></Section>)}</div>
    <div className="grid gap-5 lg:grid-cols-2"><Section><div className="flex items-center justify-between"><div><h2 className="font-bold">Routing evidence</h2><p className="mt-1 text-sm text-muted-foreground">Distribution reported by the active project's metrics response.</p></div><StatusBadge tone="information">Live metric</StatusBadge></div>{routing.length === 0 ? <DataState compact kind="empty" title="No routing distribution reported" /> : <div className="mt-5 space-y-4">{routing.map(([name, count]) => { const total = routing.reduce((sum, [, value]) => sum + value, 0); const share = total ? count / total * 100 : 0; return <div key={name}><div className="flex justify-between text-sm"><span>{name}</span><strong>{count} ({share.toFixed(0)}%)</strong></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${share}%` }} /></div></div>; })}</div>}</Section>
    <Section><h2 className="font-bold">Data contract boundary</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">The current endpoint does not expose historical SLA trends, mean ticket resolution time, channel share, or AI resolution rate. Those charts are not shown as live facts. Add authenticated time-series endpoints before introducing them.</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="surface-inset p-3"><p className="text-xs text-muted-foreground">Queue depth</p><p className="mt-1 text-xl font-bold">{metrics?.queueDepth ?? '—'}</p></div><div className="surface-inset p-3"><p className="text-xs text-muted-foreground">Ticket records</p><p className="mt-1 text-xl font-bold">{metrics?.totalTickets ?? '—'}</p></div></div></Section></div>
  </div>;
}

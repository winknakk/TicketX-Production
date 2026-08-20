import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Copy, RefreshCw, X, Bot, Zap, Sparkles, UserCheck } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Button, DataState, IconButton, LastUpdated, PageHeader, SearchField, StatusBadge } from '../components/ui/Primitives';
import { apiFetch } from '../lib/apiFetch';

export type OperationsModule = 'runtime' | 'automation' | 'prompts' | 'handoffs';

interface TraceViewerProps {
  apiBaseUrl: string;
  defaultModule?: OperationsModule;
}

interface TraceSummary {
  conversationId: string;
  tenantId?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  handoffChain?: string[];
  status: string;
  slaViolated?: boolean;
}

function traceTone(trace: TraceSummary): 'success' | 'error' | 'pending' {
  return trace.slaViolated || ['failed', 'error'].includes(trace.status?.toLowerCase())
    ? 'error'
    : ['completed', 'success'].includes(trace.status?.toLowerCase())
    ? 'success'
    : 'pending';
}

function getModuleHeader(module: OperationsModule) {
  switch (module) {
    case 'automation':
      return {
        title: 'Automation Flows',
        description: 'Workflow execution queue, BullMQ status, and Activepieces flow traces.',
        icon: Zap,
      };
    case 'prompts':
      return {
        title: 'Prompt Sessions',
        description: 'PromptX invocations, confidence score distributions, and system prompt audits.',
        icon: Sparkles,
      };
    case 'handoffs':
      return {
        title: 'Handoff Audit',
        description: 'AI-to-human handoff requests, reason codes, and operator takeover claims.',
        icon: UserCheck,
      };
    case 'runtime':
    default:
      return {
        title: 'AI Runtime',
        description: 'Live execution traces of AI Agent decisions, tool invocations, and confidence audits.',
        icon: Bot,
      };
  }
}

export function TraceViewer({ apiBaseUrl, defaultModule = 'runtime' }: TraceViewerProps) {
  const { activeProjectId } = useProject();
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'completed' | 'failed' | 'pending'>('all');
  const [selected, setSelected] = useState<TraceSummary | null>(null);

  const headerInfo = getModuleHeader(defaultModule);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/v1/admin/traces?tenantId=${encodeURIComponent(activeProjectId)}`
      );
      if (!response.ok) throw new Error(`Trace service returned ${response.status}`);
      setTraces((await response.json()) || []);
      setUpdatedAt(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Trace summaries are unavailable');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, apiBaseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return traces.filter((trace) => {
      const normalized = trace.status?.toLowerCase() || 'pending';
      const statusMatch =
        status === 'all' ||
        (status === 'completed' && ['completed', 'success'].includes(normalized)) ||
        (status === 'failed' && ['failed', 'error'].includes(normalized)) ||
        (status === 'pending' && !['completed', 'success', 'failed', 'error'].includes(normalized));
      const text = `${trace.conversationId} ${trace.tenantId || ''} ${(trace.handoffChain || []).join(
        ' '
      )}`.toLowerCase();
      return statusMatch && text.includes(search.toLowerCase());
    });
  }, [search, status, traces]);

  return (
    <div className="page-scroll space-y-5">
      <PageHeader
        eyebrow="Operations Module"
        title={headerInfo.title}
        description={headerInfo.description}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          label="Search execution logs"
          placeholder={`Search ${headerInfo.title.toLowerCase()}...`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:max-w-sm"
        />
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="group" aria-label="Status filter">
          {(['all', 'completed', 'failed', 'pending'] as const).map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={status === item}
              onClick={() => setStatus(item)}
              className={`touch-target shrink-0 rounded-md px-3 text-xs font-semibold capitalize ${
                status === item ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading && traces.length === 0 ? (
          <DataState kind="loading" title={`Loading ${headerInfo.title.toLowerCase()}`} />
        ) : error && traces.length === 0 ? (
          <DataState
            kind="error"
            title="Execution logs unavailable"
            description={error}
            actionLabel="Retry"
            onAction={load}
          />
        ) : filtered.length === 0 ? (
          <DataState
            kind="empty"
            title={search ? 'No matching logs' : 'No execution logs reported'}
            description="No trace activity recorded for current operational scope."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Execution / Conversation</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Trace Sequence / Chain</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((trace, index) => (
                  <tr key={`${trace.conversationId}-${trace.startTime || index}`} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-primary font-bold">
                      #{trace.conversationId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {trace.startTime ? new Date(trace.startTime).toLocaleString() : 'Unavailable'}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs">
                      <span className="line-clamp-2">{trace.handoffChain?.join(' → ') || 'Standard Execution'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {typeof trace.durationMs === 'number' ? `${trace.durationMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={traceTone(trace)}>
                        {trace.status || 'Success'}
                        {trace.slaViolated ? ' · SLA risk' : ''}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setSelected(trace)}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}
        >
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {headerInfo.title} Inspector
                </p>
                <h2 className="mt-1 font-mono text-lg font-bold">#{selected.conversationId}</h2>
              </div>
              <IconButton label="Close details" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>

            <dl className="divide-y divide-border rounded-xl border border-border">
              {[
                ['Status', selected.status || 'Success'],
                ['Workspace Scope', selected.tenantId || activeProjectId],
                ['Started', selected.startTime ? new Date(selected.startTime).toLocaleString() : 'Unavailable'],
                ['Ended', selected.endTime ? new Date(selected.endTime).toLocaleString() : 'Unavailable'],
                ['Latency', typeof selected.durationMs === 'number' ? `${selected.durationMs} ms` : 'Unavailable'],
                ['SLA Violation Risk', selected.slaViolated === true ? 'Yes' : 'No'],
              ].map(([term, value]) => (
                <div key={term} className="grid grid-cols-[8rem_1fr] gap-3 p-3 text-xs">
                  <dt className="text-muted-foreground font-medium">{term}</dt>
                  <dd className="text-right font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Execution Trace Sequence
              </h3>
              <p className="rounded-xl bg-muted/50 border border-border p-4 text-xs leading-relaxed font-mono">
                {selected.handoffChain?.join(' → ') || 'No handoff chain reported.'}
              </p>
            </section>

            <Button variant="secondary" className="w-full" onClick={() => navigator.clipboard.writeText(selected.conversationId)}>
              <Copy className="h-4 w-4" />
              Copy Execution ID
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  AlertTriangle,
  RotateCw,
  Users,
  Activity,
  Layers,
  Clock,
  CheckCircle,
  Eye,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';
import { API_BASE_URL } from '../lib/apiBaseUrl';
import { useProject } from '../context/ProjectContext';

export const OperationsCenter: React.FC = () => {
  const { activeProjectId } = useProject();
  const [activeTab, setActiveTab] = useState<'queues' | 'dlq' | 'handoffs'>('queues');

  // Queue Health State
  const [queueData, setQueueData] = useState<any>(null);
  const [isLoadingQueues, setIsLoadingQueues] = useState(false);

  // DLQ State
  const [deadLetters, setDeadLetters] = useState<any[]>([]);
  const [dlqTotal, setDlqTotal] = useState(0);
  const [isLoadingDlq, setIsLoadingDlq] = useState(false);
  const [selectedDlqEvent, setSelectedDlqEvent] = useState<any | null>(null);
  const [requeueingId, setRequeueingId] = useState<number | null>(null);

  // Handoff Audit State
  const [handoffs, setHandoffs] = useState<any[]>([]);
  const [handoffsTotal, setHandoffsTotal] = useState(0);
  const [isLoadingHandoffs, setIsLoadingHandoffs] = useState(false);

  // Load Queue Health
  const loadQueueHealth = useCallback(async () => {
    setIsLoadingQueues(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/admin/queues/health`);
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingQueues(false);
    }
  }, []);

  // Load DLQ
  const loadDlq = useCallback(async () => {
    setIsLoadingDlq(true);
    try {
      const url = `${API_BASE_URL}/api/admin/outbox/dead-letters?projectId=${encodeURIComponent(activeProjectId)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setDeadLetters(data.deadLetters || []);
        setDlqTotal(data.total || 0);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingDlq(false);
    }
  }, [activeProjectId]);

  // Load Handoffs
  const loadHandoffs = useCallback(async () => {
    setIsLoadingHandoffs(true);
    try {
      const url = `${API_BASE_URL}/api/admin/handoffs/audit?projectId=${encodeURIComponent(activeProjectId)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setHandoffs(data.handoffs || []);
        setHandoffsTotal(data.total || 0);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingHandoffs(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (activeTab === 'queues') loadQueueHealth();
    if (activeTab === 'dlq') loadDlq();
    if (activeTab === 'handoffs') loadHandoffs();
  }, [activeTab, loadQueueHealth, loadDlq, loadHandoffs]);

  const handleRequeue = async (id: number) => {
    setRequeueingId(id);
    try {
      const url = `${API_BASE_URL}/api/admin/outbox/dead-letters/${id}/requeue`;
      const res = await apiFetch(url, { method: 'POST' });
      if (res.ok) {
        await loadDlq();
        if (selectedDlqEvent?.id === id) {
          setSelectedDlqEvent(null);
        }
      }
    } catch {
      // Ignore
    } finally {
      setRequeueingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Operations Control Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational telemetry, background queue depths, dead letter recovery, and human handoff auditing.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
          <button
            onClick={() => setActiveTab('queues')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'queues'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Queues & Workers</span>
          </button>
          <button
            onClick={() => setActiveTab('dlq')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'dlq'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Dead Letter Queue</span>
            {dlqTotal > 0 && (
              <span className="rounded-full bg-destructive/15 px-1.5 py-0.2 text-[10px] font-bold text-destructive">
                {dlqTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('handoffs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
              activeTab === 'handoffs'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Handoff Audit</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Queue Health */}
      {activeTab === 'queues' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Redis Connection:</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  queueData?.redisStatus === 'CONNECTED'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-amber-500/10 text-amber-500'
                }`}
              >
                {queueData?.redisStatus || 'CHECKING'}
              </span>
            </div>
            <button
              onClick={loadQueueHealth}
              disabled={isLoadingQueues}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingQueues ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Queues Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(queueData?.queues || []).map((q: any) => (
              <div key={q.name} className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-xs">{q.name}</span>
                  <span
                    className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${
                      q.workerStatus === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : q.workerStatus === 'UNKNOWN'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    Worker: {q.workerStatus}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-border/60">
                  <div className="rounded bg-muted/40 p-1.5">
                    <div className="text-[9px] text-muted-foreground uppercase">Waiting</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">{q.waiting}</div>
                  </div>
                  <div className="rounded bg-muted/40 p-1.5">
                    <div className="text-[9px] text-muted-foreground uppercase">Active</div>
                    <div className="text-xs font-bold text-primary mt-0.5">{q.active}</div>
                  </div>
                  <div className="rounded bg-muted/40 p-1.5">
                    <div className="text-[9px] text-muted-foreground uppercase">Failed</div>
                    <div className={`text-xs font-bold mt-0.5 ${q.failed > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {q.failed}
                    </div>
                  </div>
                  <div className="rounded bg-muted/40 p-1.5">
                    <div className="text-[9px] text-muted-foreground uppercase">Delayed</div>
                    <div className="text-xs font-bold text-muted-foreground mt-0.5">{q.delayed}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Dead Letter Queue */}
      {activeTab === 'dlq' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Failed outbox transactions awaiting manual operator inspection and retry.
            </span>
            <button
              onClick={loadDlq}
              disabled={isLoadingDlq}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingDlq ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingDlq ? (
            <div className="flex justify-center py-12 text-xs text-muted-foreground">Loading DLQ events...</div>
          ) : deadLetters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground space-y-2">
              <CheckCircle className="h-8 w-8 mx-auto text-emerald-500 opacity-60" />
              <div className="font-semibold text-foreground">Dead Letter Queue is Clean</div>
              <p>No failed or permanently abandoned outbox events found in this project.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                    <th className="p-3">ID</th>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Failure Kind</th>
                    <th className="p-3">Attempts</th>
                    <th className="p-3">Error Snippet</th>
                    <th className="p-3">Dead Lettered At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deadLetters.map((dl) => (
                    <tr key={dl.id} className="hover:bg-muted/20 transition">
                      <td className="p-3 font-mono font-bold text-foreground">#{dl.id}</td>
                      <td className="p-3 font-semibold text-primary">{dl.eventType}</td>
                      <td className="p-3">
                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive uppercase">
                          {dl.failureKind}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-foreground">{dl.attempts}</td>
                      <td className="p-3 max-w-xs truncate text-muted-foreground" title={dl.errorMessage}>
                        {dl.errorMessage || 'No error details'}
                      </td>
                      <td className="p-3 text-muted-foreground text-[11px]">
                        {dl.deadLetteredAt ? new Date(dl.deadLetteredAt).toLocaleString() : dl.updatedAt}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedDlqEvent(dl)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                          title="Inspect Payload"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRequeue(dl.id)}
                          disabled={requeueingId === dl.id}
                          className="rounded bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer disabled:opacity-50"
                        >
                          {requeueingId === dl.id ? 'Requeueing...' : 'Requeue'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Handoff Audit */}
      {activeTab === 'handoffs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Audit log of bot-to-human escalations, claims, timeouts, and operator intervention durations.
            </span>
            <button
              onClick={loadHandoffs}
              disabled={isLoadingHandoffs}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingHandoffs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingHandoffs ? (
            <div className="flex justify-center py-12 text-xs text-muted-foreground">Loading handoffs...</div>
          ) : handoffs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
              No human handoffs recorded for this project yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                    <th className="p-3">Handoff ID</th>
                    <th className="p-3">Room / Conv</th>
                    <th className="p-3">Trigger Type</th>
                    <th className="p-3">From &rarr; To</th>
                    <th className="p-3">Assigned Operator</th>
                    <th className="p-3">Started At</th>
                    <th className="p-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {handoffs.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/20 transition">
                      <td className="p-3 font-mono font-bold text-foreground">#{h.id}</td>
                      <td className="p-3 font-medium text-foreground">Room #{h.conversationId}</td>
                      <td className="p-3">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {h.triggerType}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground font-medium uppercase text-[10px]">
                        {h.fromOwner} &rarr; {h.toOwner}
                      </td>
                      <td className="p-3 font-medium text-foreground">
                        {h.toOperatorName || '--'}
                      </td>
                      <td className="p-3 text-muted-foreground text-[11px]">
                        {new Date(h.startedAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-muted-foreground text-[11px]">
                        {h.durationSeconds ? `${Math.floor(h.durationSeconds / 60)}m ${h.durationSeconds % 60}s` : 'Active'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DLQ Payload Inspector Modal */}
      {selectedDlqEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-bold text-foreground text-sm">
                Inspect DLQ Event #{selectedDlqEvent.id} ({selectedDlqEvent.eventType})
              </span>
              <button
                onClick={() => setSelectedDlqEvent(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-muted-foreground text-[11px]">Sanitized Payload:</div>
              <pre className="max-h-60 overflow-y-auto rounded-lg bg-background p-3 text-[10.5px] font-mono border border-border text-foreground">
                {JSON.stringify(selectedDlqEvent.payload, null, 2)}
              </pre>
            </div>

            {selectedDlqEvent.errorMessage && (
              <div className="space-y-1">
                <div className="font-semibold text-destructive text-[11px]">Recorded Error:</div>
                <div className="rounded-lg bg-destructive/10 p-3 text-destructive font-mono text-[10.5px]">
                  {selectedDlqEvent.errorMessage}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setSelectedDlqEvent(null)}
                className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleRequeue(selectedDlqEvent.id)}
                disabled={requeueingId === selectedDlqEvent.id}
                className="rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
              >
                {requeueingId === selectedDlqEvent.id ? 'Requeueing...' : 'Requeue Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

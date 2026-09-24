import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Filter, Clock, Eye, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';
import { API_BASE_URL } from '../lib/apiBaseUrl';
import { useProject } from '../context/ProjectContext';

export const AuditLogs: React.FC = () => {
  const { activeProjectId } = useProject();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `${API_BASE_URL}/api/admin/audit-logs?projectId=${encodeURIComponent(activeProjectId)}`;
      if (actionFilter) {
        url += `&action=${encodeURIComponent(actionFilter)}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, actionFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Administrative Audit Trail
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable log of all administrative actions, ticket merges, DLQ requeues, SLA interventions, and note creations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            <option value="">All Actions ({total})</option>
            <option value="NOTE_CREATED">NOTE_CREATED</option>
            <option value="NOTE_PINNED">NOTE_PINNED</option>
            <option value="NOTE_DELETED">NOTE_DELETED</option>
            <option value="TICKET_MERGE">TICKET_MERGE</option>
            <option value="TICKET_REASSIGNED">TICKET_REASSIGNED</option>
            <option value="DLQ_REQUEUE">DLQ_REQUEUE</option>
            <option value="SLA_CLOSE">SLA_CLOSE</option>
            <option value="SLA_DELIVER">SLA_DELIVER</option>
            <option value="SLA_SHIFT_CLOCK">SLA_SHIFT_CLOCK</option>
            <option value="SLA_BULK_ACTION">SLA_BULK_ACTION</option>
          </select>

          <button
            onClick={fetchAuditLogs}
            disabled={isLoading}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-xs text-muted-foreground">Loading audit records...</div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
          No audit records found for this project and filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                <th className="p-3">ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Actor / Operator</th>
                <th className="p-3">Project</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition">
                  <td className="p-3 font-mono text-muted-foreground">#{log.id}</td>
                  <td className="p-3 text-muted-foreground text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-foreground">{log.actor}</td>
                  <td className="p-3 text-muted-foreground font-mono">
                    {log.projectId ? `Project #${log.projectId}` : 'Global'}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-bold text-foreground text-sm">
                Audit Record #{selectedLog.id} &mdash; {selectedLog.action}
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground block">Actor:</span>
                <span className="font-semibold text-foreground">{selectedLog.actor}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Timestamp:</span>
                <span className="font-semibold text-foreground">{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {selectedLog.oldValue && Object.keys(selectedLog.oldValue).length > 0 && (
              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground text-[10px] uppercase">Previous State:</span>
                <pre className="max-h-36 overflow-y-auto rounded-md bg-background p-2.5 font-mono text-[10.5px] border border-border text-muted-foreground">
                  {JSON.stringify(selectedLog.oldValue, null, 2)}
                </pre>
              </div>
            )}

            <div className="space-y-1">
              <span className="font-semibold text-muted-foreground text-[10px] uppercase">New / Mutation State:</span>
              <pre className="max-h-48 overflow-y-auto rounded-md bg-background p-2.5 font-mono text-[10.5px] border border-border text-foreground">
                {JSON.stringify(selectedLog.newValue, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

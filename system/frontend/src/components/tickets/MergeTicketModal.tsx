import React, { useState } from 'react';
import { GitMerge, AlertTriangle, X, Check } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { API_BASE_URL } from '../../lib/apiBaseUrl';

interface MergeTicketModalProps {
  sourceTicket: {
    id: number | string;
    ticketId: string;
    subject: string;
    projectId?: number | string;
  };
  candidateTickets?: Array<{ id: number | string; ticketId: string; subject: string; status: string }>;
  onClose: () => void;
  onMerged?: (targetTicketId: string | number) => void;
}

export const MergeTicketModal: React.FC<MergeTicketModalProps> = ({
  sourceTicket,
  candidateTickets = [],
  onClose,
  onMerged,
}) => {
  const [targetId, setTargetId] = useState<string>('');
  const [reason, setReason] = useState<string>('Duplicate customer inquiry');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/admin/tickets/${sourceTicket.id}/merge`;
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTicketId: targetId,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Merge failed (${res.status})`);
      }

      const data = await res.json();
      if (onMerged) {
        onMerged(data.targetTicketId || targetId);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to merge tickets');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCandidates = candidateTickets.filter(
    (t) => String(t.id) !== String(sourceTicket.id) && t.ticketId !== sourceTicket.ticketId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 font-bold text-foreground text-sm">
            <GitMerge className="h-4 w-4 text-primary" />
            <span>Merge Duplicate Ticket</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-[11px] text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Source Ticket Card */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
          <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Source (Will be Closed/Resolved)</div>
          <div className="font-bold text-foreground">
            #{sourceTicket.ticketId} — {sourceTicket.subject}
          </div>
        </div>

        <form onSubmit={handleMerge} className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground block">
              Merge Into (Canonical Target Ticket)
            </label>
            {availableCandidates.length > 0 ? (
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Select Target Ticket --</option>
                {availableCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.ticketId} ({c.status}) — {c.subject.slice(0, 40)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Enter Target Ticket ID or Number (e.g. 12 or TCK-1002)"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
              </input>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground block">
              Merge Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for merge"
              required
              className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="rounded-lg bg-muted/40 p-2.5 text-[10.5px] text-muted-foreground leading-relaxed">
            <strong>What will happen:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Source ticket #{sourceTicket.ticketId} will transition to <strong>RESOLVED</strong> (duplicate).</li>
              <li>An internal note will be appended to the target ticket documenting the merge.</li>
              <li>Active customer room focus will redirect to the target ticket.</li>
              <li>An administrative audit log entry will be created.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!targetId || isSubmitting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Merging...' : 'Confirm Merge'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

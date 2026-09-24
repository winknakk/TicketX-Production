import React, { useState, useEffect, useCallback } from 'react';
import { Pin, Trash2, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { API_BASE_URL } from '../../lib/apiBaseUrl';

export interface InternalNote {
  id: number;
  conversationId: number;
  ticketId: number;
  operatorId: number;
  operatorName: string;
  operatorEmail?: string;
  content: string;
  isPinned: boolean;
  mentionedOps: number[];
  createdAt: string;
  updatedAt: string;
}

interface InternalNotesTabProps {
  ticketId: string | number | null;
  projectId?: string | number | null;
}

export const InternalNotesTab: React.FC<InternalNotesTabProps> = ({ ticketId, projectId }) => {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!ticketId) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/admin/tickets/${ticketId}/notes${projectId ? `?projectId=${projectId}` : ''}`;
      const res = await apiFetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to load notes (${res.status})`);
      }
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err: any) {
      setError(err.message || 'Error loading internal notes');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, projectId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/admin/tickets/${ticketId}/notes${projectId ? `?projectId=${projectId}` : ''}`;
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), isPinned }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to create note');
      }
      setContent('');
      setIsPinned(false);
      await fetchNotes();
    } catch (err: any) {
      setError(err.message || 'Error creating internal note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async (noteId: number, currentPinned: boolean) => {
    if (!ticketId) return;
    try {
      const url = `${API_BASE_URL}/api/admin/tickets/${ticketId}/notes/${noteId}/pin${projectId ? `?projectId=${projectId}` : ''}`;
      const res = await apiFetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      if (res.ok) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, isPinned: !currentPinned } : n))
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!ticketId) return;
    if (!window.confirm('Are you sure you want to delete this internal note?')) return;
    try {
      const url = `${API_BASE_URL}/api/admin/tickets/${ticketId}/notes/${noteId}${projectId ? `?projectId=${projectId}` : ''}`;
      const res = await apiFetch(url, { method: 'DELETE' });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch {
      // Ignore
    }
  };

  if (!ticketId) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        Select a ticket to view and write internal notes.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
          <span>Internal Notes</span>
          <span className="text-[10px] text-muted-foreground font-normal">({notes.length})</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-semibold">
          Internal Only (Never Sent to Customer)
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 p-2.5 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleCreateNote} className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-xs">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add an internal operator note (shift handover, technical findings, instructions)..."
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <Pin className={`h-3 w-3 ${isPinned ? 'text-amber-500 fill-amber-500' : ''}`} />
            <span>Pin note to top</span>
          </label>
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 transition cursor-pointer"
          >
            <Send className="h-3 w-3" />
            <span>{isSubmitting ? 'Posting...' : 'Post Note'}</span>
          </button>
        </div>
      </form>

      {/* Notes List */}
      {isLoading ? (
        <div className="flex justify-center py-6 text-muted-foreground text-[11px]">
          Loading internal notes...
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 p-4 text-center text-[11px] text-muted-foreground">
          No internal notes recorded on this ticket yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg border p-3 transition space-y-1.5 ${
                note.isPinned
                  ? 'border-amber-500/40 bg-amber-500/5 shadow-xs'
                  : 'border-border/60 bg-muted/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground text-[11px]">
                    {note.operatorName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(note.createdAt).toLocaleDateString()} {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {note.isPinned && (
                    <span className="flex items-center gap-0.5 rounded px-1.5 py-0.2 bg-amber-500/15 text-amber-500 text-[9px] font-bold">
                      <Pin className="h-2.5 w-2.5 fill-amber-500" />
                      PINNED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleTogglePin(note.id, note.isPinned)}
                    title={note.isPinned ? 'Unpin note' : 'Pin note'}
                    className="p-1 rounded text-muted-foreground hover:text-amber-500 hover:bg-muted transition cursor-pointer"
                  >
                    <Pin className={`h-3 w-3 ${note.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    title="Delete note"
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap font-normal">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

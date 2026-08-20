import React from 'react';
import { useConversation } from '../../context/ConversationContext';
import { InlineAlert } from '../ui/Primitives';

export const TicketPanel: React.FC = () => {
  const {
    selectedConvId,
    tickets,
    isCreatingTicket,
    isPromotingTicket,
    ticketSubject,
    setTicketSubject,
    ticketSummary,
    setTicketSummary,
    ticketPriority,
    setTicketPriority,
    handleCreateTicket,
    handlePromoteTicket,
    profileData
  } = useConversation();

  const selectedPriorityMeta = profileData?.project?.priorities?.find((p: any) => p.code === ticketPriority);

  if (!selectedConvId) {
    return (
      <div className="bg-card/40 border border-border border-dashed rounded-xl p-4 text-center text-muted-foreground text-xs font-medium">
        Tickets are only available on active channels.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Customer Ticket History from Profile */}
      {profileData && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block border-b border-border/40 pb-2">Ticket History</span>
          {profileData.ticket_history.length > 0 ? (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {profileData.ticket_history.map((th: any, idx: number) => (
                <div key={idx} className="space-y-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-primary text-[10.5px]">#{th.ticketId || th.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      th.status === 'Open' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'
                    }`}>{th.status}</span>
                  </div>
                  <div className="font-semibold text-foreground truncate">{th.subject}</div>
                  <div className="flex justify-between items-center text-[9px] text-muted-foreground">
                    <span>Sev: <strong className="text-foreground">{th.severity}</strong></span>
                    <span>Pri: <strong className="text-foreground">{th.priority}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-[10.5px] text-muted-foreground/60 py-2">
              No tickets created yet.
            </div>
          )}
        </div>
      )}

      {/* Active Conversation Ticket Details */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block border-b border-border/40 pb-2">Support Ticket</span>
        {tickets.length > 0 ? (
          tickets.map((t, idx) => {
            const dbId = t.id1 || t.id || '';
            const tId = t.ticketId || t.ticket_id || '--';
            const isPromoted = t.planeIssueId || t.plane_issue_id;

            return (
              <div key={idx} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary text-xs">{tId}</span>
                  <span className="badge badge-open text-[10px]">{t.status}</span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px]">
                  {(() => {
                    const rawType = ((t.created_by_type || t.createdByType || (t as any).createdBy || 'CUSTOMER') as string).toUpperCase();
                    const name = t.created_by_name || t.createdByName;
                    if (rawType.includes('AI')) return <span className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-md font-bold shadow-xs">🤖 AI Bot</span>;
                    if (rawType.includes('HUMAN') || rawType.includes('AGENT')) return <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-bold shadow-xs">🎧 {name || 'Agent'}</span>;
                    if (rawType.includes('PLANE')) return <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-bold shadow-xs">✈️ {name || 'Plane.io'}</span>;
                    return <span className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md font-bold shadow-xs">👤 {name || 'Customer'}</span>;
                  })()}
                </div>
                
                <div className="text-xs font-bold text-foreground leading-snug">{t.subject}</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">{t.summary}</p>
                
                <div className="flex items-center justify-between text-[11px] font-semibold border-t border-border/40 pt-2 text-muted-foreground">
                  <span>Severity: <strong className="text-foreground">{t.severity}</strong></span>
                  <span>Priority: <strong className="text-foreground">{t.priority}</strong></span>
                </div>

                {isPromoted ? (
                  (() => {
                    const rawTicket = t as any;
                    const planeWs = rawTicket.plane_workspace_slug || rawTicket.planeWorkspaceSlug || 'cs-team';
                    const planeProj = rawTicket.plane_project_id || rawTicket.planeProjectId || (rawTicket.project_id === 101 ? 'e3454524-961a-4b84-8ccb-71575baaa696' : '09aa9c0e-8448-426f-8128-306c3dcf9d78');
                    const planeUrl = `https://projects.oneweb.tech/${planeWs}/projects/${planeProj}/issues/${isPromoted}`;
                    return (
                      <a
                        href={planeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-success/15 border border-success/30 rounded-lg p-2.5 text-center text-success text-[10px] font-bold mt-2 font-sans flex items-center justify-center gap-1 hover:underline cursor-pointer"
                      >
                        ✓ Promoted to Plane ↗ <span className="font-mono tracking-wider">({isPromoted})</span>
                      </a>
                    );
                  })()
                ) : (
                  <button
                    onClick={() => handlePromoteTicket(dbId)}
                    disabled={isPromotingTicket === dbId}
                    className="w-full mt-2 py-2 bg-primary text-white font-bold text-xs rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
                  >
                    {isPromotingTicket === dbId ? 'Promoting...' : '🚀 Promote to Plane'}
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-card/40 border border-border border-dashed rounded-xl p-4 text-center text-muted-foreground text-xs font-medium">
            No ticket linked to this room.
          </div>
        )}
      </div>

      {/* Create Ticket Form (ALWAYS AVAILABLE FOR ADMIN) */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block border-b border-border/40 pb-2">Create Ticket</span>
        <form onSubmit={handleCreateTicket} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="space-y-1">
            <label htmlFor="ticket-subject" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</label>
            <input
              id="ticket-subject"
              type="text"
              required
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              className="field-control w-full text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ticket-summary" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Summary</label>
            <textarea
              id="ticket-summary"
              rows={2}
              required
              value={ticketSummary}
              onChange={(e) => setTicketSummary(e.target.value)}
              className="field-control w-full resize-none text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="ticket-priority" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Priority</label>
            <select
              id="ticket-priority"
              value={ticketPriority}
              onChange={(e) => setTicketPriority(e.target.value)}
              className="field-control w-full cursor-pointer text-sm"
            >
              {(profileData?.project?.priorities || []).length > 0 ? (
                profileData.project.priorities.map((p: any) => (
                  <option key={p.code} value={p.code}>{p.code}</option>
                ))
              ) : (
                ["P1", "P2", "P3", "P4"].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))
              )}
            </select>
          </div>
          {selectedPriorityMeta && (
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40 space-y-1 text-[10.5px] text-muted-foreground font-semibold">
              <div className="font-bold text-foreground text-xs flex justify-between">
                <span>{selectedPriorityMeta.name}</span>
                <span className="text-primary font-bold">{selectedPriorityMeta.serviceWindow}</span>
              </div>
              {selectedPriorityMeta.description && (
                <p className="text-[10px] font-medium leading-normal italic text-muted-foreground/80">{selectedPriorityMeta.description}</p>
              )}
              <div className="flex justify-between border-t border-border/20 pt-1.5 mt-1 font-bold">
                <span>Response: <strong className="text-foreground">{selectedPriorityMeta.responseHours}h</strong></span>
                <span>Resolve: <strong className="text-foreground">{selectedPriorityMeta.resolveHours}h</strong></span>
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={isCreatingTicket}
            className="touch-target w-full bg-primary text-white font-bold text-xs rounded-lg shadow-sm hover:opacity-90 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreatingTicket ? 'Creating...' : 'Create Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
};

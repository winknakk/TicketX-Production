import React, { useEffect } from 'react';
import { Mail, Phone, Sparkles, Building2, FolderKanban, Activity, ChevronRight, X } from 'lucide-react';
import { useConversation } from '../../context/ConversationContext';
import { TicketPanel } from './TicketPanel';
import { cn } from '../../lib/utils';
import { DataState, IconButton } from '../ui/Primitives';

export const CRMWorkspace: React.FC<{ className?: string; onClose?: () => void }> = ({ className, onClose }) => {
  const {
    selectedCustomerId,
    selectedConvId,
    activeChannelTab,
    conversations,
    profileData,
    isLoadingProfile,
    profileError,
    isCrmCollapsed,
    setIsCrmCollapsed,
    getTimelineItems,
    fetchProfile,
    customers,
    tickets
  } = useConversation();

  const selectedCustomer = customers.find(cust => cust.id === selectedCustomerId);
  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  const activeTicket = tickets.length > 0 ? tickets[0] : null;
  const currentPriorityCode = activeTicket ? (activeTicket.priority || activeTicket.severity) : (profileData?.project?.defaultPriority || profileData?.project?.priorities?.[0]?.code || "");
  const matchedPriority = profileData?.project?.priorities?.find((p: any) => p.code === currentPriorityCode) || profileData?.project?.priorities?.[0];

  // Keep CRM details aligned with the active room, including after a project switch.
  useEffect(() => {
    if (selectedConvId) {
      fetchProfile(selectedConvId);
    }
  }, [selectedConvId]);

  if (isCrmCollapsed) return null;

  if (!selectedCustomer) {
    return (
      <aside className={cn("w-full border-l border-border bg-card p-5 overflow-y-auto shrink-0 flex flex-col items-center justify-center text-muted-foreground text-center xl:w-80", className)}>
        <Activity className="h-10 w-10 mb-2 opacity-40 text-primary" />
        <span className="text-xs font-medium">Select a customer workspace to view details.</span>
      </aside>
    );
  }

  const timelineItems = getTimelineItems();

  return (
    <aside className={cn("w-full border-l border-border bg-background px-4 py-4 sm:px-5 overflow-y-auto shrink-0 flex flex-col gap-6 xl:w-72", className)} aria-label="Customer and ticket context">
      {/* CRM Header with Collapse Button */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-1">
        <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span>CRM Workspace</span>
        </h2>
        <div className="flex items-center gap-1">
        {onClose && <IconButton label="Close context" onClick={onClose} className="xl:hidden"><X className="h-4 w-4" /></IconButton>}
        <button
          onClick={() => setIsCrmCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        </div>
      </div>

      {isLoadingProfile ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
          <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-black animate-spin" />
          <span className="text-[11px] font-medium">Loading CRM profile...</span>
        </div>
      ) : profileError ? (
        <DataState kind="error" compact title="Customer context unavailable" description={profileError} actionLabel="Retry" onAction={() => selectedConvId && fetchProfile(selectedConvId)} />
      ) : profileData ? (
        <>
          {/* 1. Customer Identity & Avatar */}
          <div className="border-b border-border pb-5 space-y-3.5">
            <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Customer profile</span>
            <div className="flex items-center gap-3">
              {profileData?.identity?.avatar_url ? (
                <img 
                  src={profileData.identity.avatar_url} 
                  alt={profileData.identity.profile_name || 'Customer'} 
                  className="h-10 w-10 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
                  {(profileData?.identity?.profile_name || selectedCustomer?.name || 'CU').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                  {profileData?.identity?.profile_name || selectedCustomer?.name || '-'}
                </div>
                <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <span className="bg-muted text-foreground px-1.5 py-0.5 rounded uppercase text-[9px] font-bold">
                    {selectedConversation ? selectedConversation.channel : activeChannelTab}
                  </span>
                  <span>{selectedConversation ? `#${selectedConversation.id}` : '#inactive'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground font-medium" title={profileData?.identity?.email || '-'}>{profileData?.identity?.email || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">{profileData?.identity?.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                <span className="font-mono text-muted-foreground/80 break-all">Ref: {profileData?.identity?.channel_ref || '-'}</span>
              </div>
            </div>
          </div>

          {/* 2. AI Generated Summary */}
          <div className="border-b border-border pb-5 space-y-2">
            <div className="flex items-center gap-1.5 text-foreground font-bold text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>AI Case Summary</span>
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-1.5">
              {(() => {
                const raw = profileData.ai_summary || '';
                // Split by newline, period+space, or bullet markers
                const lines = raw
                  .split(/\n|(?<=\.)\s+(?=[A-Z\u0E00-\u0E7F])/)
                  .map((s: string) => s.replace(/^[-•*]\s*/, '').trim())
                  .filter((s: string) => s.length > 0);
                if (lines.length <= 1) {
                  return (
                    <p className="text-[11.5px] text-foreground leading-relaxed font-medium">{raw}</p>
                  );
                }
                return lines.map((line: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                    <p className="text-[11.5px] text-foreground leading-relaxed font-medium">{line}</p>
                  </div>
                ));
              })()}
            </div>
          </div>


          {/* 3. Company & Project Context */}
          <div className="border-b border-border pb-5 space-y-3">
            <span className="text-xs font-semibold text-muted-foreground block">Business and context</span>
            
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10.5px] text-muted-foreground">Company</div>
                  <div className="text-xs font-bold text-foreground">{profileData.project?.company || '--'}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 border-t border-border/40 pt-2.5">
                <FolderKanban className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                <div className="w-full space-y-2">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Project</div>
                      <div className="font-bold text-foreground truncate">{profileData.project?.name || '--'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Environment</div>
                      <div className="font-bold text-foreground truncate">{profileData.project?.environment || '--'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Project Type</div>
                      <div className="font-bold text-foreground truncate">{profileData.project?.projectType || '--'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Priority</div>
                      <div className="font-bold text-foreground">
                        {matchedPriority ? `${matchedPriority.code} (${matchedPriority.name})` : (currentPriorityCode || '--')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Service Window</div>
                      <div className="font-bold text-foreground">{matchedPriority?.serviceWindow || '--'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Response SLA</div>
                      <div className="font-bold text-primary">{matchedPriority ? `${matchedPriority.responseHours} Hours` : '--'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Resolve SLA</div>
                      <div className="font-bold text-primary">{matchedPriority ? `${matchedPriority.resolveHours} Hours` : '--'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Customer Activity Summary */}
          <div className="border-b border-border pb-5 space-y-3">
            <span className="text-xs font-semibold text-muted-foreground block">Customer activity</span>
            
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="border-l border-border p-2 first:border-l-0">
                <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider">Conversations</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{profileData.customer_activity_summary.total_conversations}</div>
              </div>
              <div className="border-l border-border p-2">
                <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider">Total Messages</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{profileData.customer_activity_summary.total_messages}</div>
              </div>
              <div className="border-l border-border p-2 first:border-l-0">
                <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider">Total Tickets</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{profileData.customer_activity_summary.total_tickets}</div>
              </div>
              <div className="border-l border-border p-2">
                <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider">Resolved Tickets</div>
                <div className="text-sm font-bold text-success mt-0.5">{profileData.customer_activity_summary.resolved_tickets}</div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 text-[11px] text-muted-foreground">
              <div className="flex justify-between items-center">
                <span>Pending Tickets:</span>
                <span className="font-bold text-warning">{profileData.customer_activity_summary.pending_tickets}</span>
              </div>
            </div>
          </div>

          {/* 5. Previous Conversations list */}
          <div className="border-b border-border pb-5 space-y-3">
            <span className="text-xs font-semibold text-muted-foreground block">Other rooms</span>
            {profileData.previous_conversations.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {profileData.previous_conversations.map((pc: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border py-2 text-xs last:border-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-foreground">Room #{pc.id}</span>
                      <span className="text-[9px] text-muted-foreground/60 font-semibold">{new Date(pc.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-1 py-0.5 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground`}>
                        {pc.channel}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        pc.status === 'open' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
                      }`}>
                        {pc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-[10.5px] text-muted-foreground/60 py-2">
                No other rooms.
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Ticket Panel */}
      <TicketPanel />

      {/* 5. Activity Timeline */}
      <div className="space-y-3 pt-2">
        <span className="text-xs font-semibold text-muted-foreground block border-b border-border pb-2">Activity timeline</span>
        {selectedConversation && timelineItems.length > 0 ? (
          <div className="relative border-l border-border pl-4 ml-2 space-y-4 pt-1">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="relative">
                {/* Timeline Dot */}
                <span className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background ${item.dotColor} shadow-sm`} />
                
                <div className="space-y-1">
                  <div className="text-[10.5px] font-bold text-foreground flex items-center justify-between gap-2">
                    <span>{item.title}</span>
                    <span className="text-[9px] text-muted-foreground font-normal">{item.time}</span>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-relaxed font-medium whitespace-pre-line">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-l-2 border-border p-4 text-center text-muted-foreground text-xs font-medium">
            {selectedConversation ? 'No activity logged in this room.' : 'Select an active channel to view timeline.'}
          </div>
        )}
      </div>
    </aside>
  );
};

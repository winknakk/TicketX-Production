import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Ticket, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  Send, 
  Building2, 
  RefreshCw,
  ShieldCheck,
  Zap,
  Filter,
  Bot,
  User,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { Button, PageHeader, SearchField, StatusBadge } from '../components/ui/Primitives';

export interface PortalTicket {
  id: number;
  ticket_number: string;
  subject: string;
  summary: string;
  status: string;
  priority: string;
  severity: string;
  due_date?: string;
  created_at: string;
  org_id?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'human';
  text: string;
  time: string;
}

export function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'create'>('chat');
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState('P3');
  const [severity, setSeverity] = useState('Medium');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Live WebChat AI State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init_welcome',
      sender: 'bot',
      text: 'สวัสดีค่ะ! ยินดีต้อนรับสู่ TicketX Customer Support Portal มีเรื่องใดให้ระบบหรือแอดมินดูแลวันนี้คะ?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [takeoverActive, setTakeoverActive] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = apiBaseUrl.replace(/^https?:\/\//, '');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isAgentTyping]);

  // Connect to WebChat Gateway & WebSocket
  useEffect(() => {
    isMountedRef.current = true;
    let ws: WebSocket | null = null;

    const initWebChat = async () => {
      try {
        const activeOrgId = localStorage.getItem('active_org_id') || 'org_default';
        const guestUuidKey = `ticketx_portal_guest_uuid_${activeOrgId}`;
        let guestUuid = localStorage.getItem(guestUuidKey);
        if (!guestUuid) {
          guestUuid = `guest_${Math.random().toString(36).substring(2, 11)}`;
          localStorage.setItem(guestUuidKey, guestUuid);
        }

        const res = await fetch(`${apiBaseUrl}/api/v1/webchat/handshake`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: '1',
            guestUuid
          })
        });

        if (!isMountedRef.current) return;
        const data = await res.json();
        if (data.token) {
          setIsConnected(true);

          // Fetch message history
          try {
            const histRes = await fetch(`${apiBaseUrl}/api/v1/webchat/messages`, {
              headers: { Authorization: `Bearer ${data.token}` }
            });
            const histData = await histRes.json();
            if (histData.messages && Array.isArray(histData.messages) && histData.messages.length > 0) {
              const parsed = histData.messages.map((m: any) => ({
                id: m.id || String(Math.random()),
                sender: m.role === 'customer' ? 'user' : m.role === 'human' ? 'human' : 'bot',
                text: m.content || m.text || '',
                time: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }));
              setChatMessages((prev) => [prev[0], ...parsed]);
              if (histData.messages.some((m: any) => m.role === 'human')) {
                setTakeoverActive(true);
              }
            }
          } catch (e) {
            console.warn('Could not fetch message history:', e);
          }

          // Connect WebSocket
          const wsUrl = `${wsProtocol}//${wsHost}/api/v1/webchat/socket?token=${data.token}`;
          ws = new WebSocket(wsUrl);
          socketRef.current = ws;

          ws.onopen = () => {
            if (!isMountedRef.current) return;
            setIsConnected(true);
          };

          ws.onmessage = (event) => {
            if (!isMountedRef.current) return;
            try {
              const payload = JSON.parse(event.data);
              if (payload.event === 'message') {
                const msgData = payload.data;
                const senderRole = msgData.role === 'customer' ? 'user' : msgData.role === 'human' ? 'human' : 'bot';
                setChatMessages((prev) => {
                  if (senderRole === 'user' && prev.some((p) => p.text === msgData.content && p.sender === 'user')) {
                    return prev;
                  }
                  return [
                    ...prev,
                    {
                      id: msgData.id || String(Math.random()),
                      sender: senderRole,
                      text: msgData.content,
                      time: new Date(msgData.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ];
                });
                setIsAgentTyping(false);
                if (msgData.role === 'human') setTakeoverActive(true);
              } else if (payload.event === 'typing') {
                setIsAgentTyping(!!payload.data?.isTyping);
              }
            } catch (err) {
              console.error('Socket message parse error:', err);
            }
          };

          ws.onerror = () => {
            if (!isMountedRef.current) return;
            setIsConnected(false);
          };

          ws.onclose = () => {
            if (!isMountedRef.current) return;
            setIsConnected(false);
            // Auto reconnect after 3 seconds
            setTimeout(() => {
              if (isMountedRef.current) initWebChat();
            }, 3000);
          };
        }
      } catch (err) {
        console.warn('WebChat Gateway connection error:', err);
        setIsConnected(false);
        setTimeout(() => {
          if (isMountedRef.current) initWebChat();
        }, 4000);
      }
    };

    initWebChat();

    return () => {
      isMountedRef.current = false;
      if (ws) ws.close();
    };
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem('active_org_id') || 'org_default';
      const res = await fetch(`${apiBaseUrl}/api/portal/tickets`, {
        headers: { 'X-Org-Id': orgId }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      }
    } catch (e) {
      console.error('Failed to fetch portal tickets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim()) return;
    const userMsg = inputMsg.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = `temp_${Date.now()}`;

    setChatMessages((prev) => [...prev, { id: tempId, sender: 'user', text: userMsg, time }]);
    setInputMsg('');
    setIsAgentTyping(true);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text: userMsg, tempId }));
    } else {
      // Offline / Fallback response if WebSocket is disconnected
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `fallback_${Date.now()}`,
            sender: 'bot',
            text: `รับทราบค่ะ ระบบได้รับข้อความ "${userMsg}" และกำลังประสานงานให้แอดมินดูแลทันที`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsAgentTyping(false);
      }, 1000);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !summary.trim()) return;
    setSubmitting(true);
    setSuccessMessage('');

    try {
      const orgId = localStorage.getItem('active_org_id') || 'org_default';
      const res = await fetch(`${apiBaseUrl}/api/portal/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-Id': orgId
        },
        body: JSON.stringify({
          customerId: 'cust_portal_user',
          projectId: '1',
          subject,
          summary,
          priority,
          severity
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`เปิดตั๋วใหม่สำเร็จ! หมายเลขตั๋วของคุณคือ ${data.ticketNumber}`);
        setSubject('');
        setSummary('');
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch = t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-scroll space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page Header matching App Design System */}
      <PageHeader
        eyebrow="Customer Self-Service"
        title="Customer Support Portal"
        description={`Live support & incident management for Organization: ${localStorage.getItem('active_org_id') || 'Avalant Co.,Ltd.'}`}
        actions={
          <div className="flex max-w-full gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`touch-target shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'chat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Live Chat Support
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`touch-target shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Ticket className="h-3.5 w-3.5" /> Ticket History ({tickets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`touch-target shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'create' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" /> New Ticket
            </button>
          </div>
        }
      />

      {/* TAB 1: LIVE CHAT SUPPORT */}
      {activeTab === 'chat' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-[600px] shadow-sm">
          <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <span className="text-xs font-bold text-foreground">
                  AI Assistant & Live Support Queue
                </span>
                <span className="text-[10px] text-muted-foreground ml-2">
                  {isConnected ? '• WebChat Gateway Live' : '• Connecting Gateway...'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {takeoverActive && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Human Agent Active
                </span>
              )}
              <StatusBadge tone="information">Response SLA &lt; 5 mins</StatusBadge>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-muted/10">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-muted-foreground font-semibold">
                  {msg.sender === 'user' ? (
                    <><span>You</span><User className="h-3 w-3" /></>
                  ) : msg.sender === 'human' ? (
                    <><span className="text-amber-600 dark:text-amber-400 font-bold">Support Agent (Human)</span></>
                  ) : (
                    <><Bot className="h-3 w-3 text-primary" /><span className="text-primary font-bold">AI Support Assistant</span></>
                  )}
                </div>
                <div
                  className={`max-w-lg p-3.5 rounded-xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none shadow-sm'
                      : msg.sender === 'human'
                      ? 'bg-amber-500/10 text-foreground border border-amber-500/30 rounded-bl-none shadow-xs'
                      : 'bg-card text-card-foreground border border-border rounded-bl-none shadow-xs'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
              </div>
            ))}

            {isAgentTyping && (
              <div className="flex flex-col items-start">
                <div className="p-3 rounded-xl bg-card border border-border rounded-bl-none flex items-center gap-1.5 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                  <span className="text-[10px] text-muted-foreground ml-1">AI Assistant กำลังพิมพ์คำตอบ...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-3 border-t border-border bg-card flex items-center gap-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="พิมพ์ข้อความเพื่อสนทนากับ AI หรือแจ้งปัญหาที่นี่..."
              className="flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button type="submit" disabled={!inputMsg.trim()} className="px-4 py-2 text-xs">
              <Send className="h-3.5 w-3.5" /> ส่งข้อความ
            </Button>
          </form>
        </div>
      )}

      {/* TAB 2: TICKET HISTORY & REAL-TIME STATUS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
            <SearchField
              label="Search tickets"
              placeholder="Search ticket # or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-80"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="backlog">Open / Backlog</option>
                <option value="in progress">In Progress</option>
                <option value="done">Done / Resolved</option>
              </select>
              <Button variant="secondary" onClick={fetchTickets} disabled={loading} className="px-3">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Ticket #</th>
                    <th className="px-4 py-3">Subject & Summary</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{t.ticket_number}</td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="font-semibold text-foreground text-xs">{t.subject}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.summary || 'No summary reported'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={t.priority === 'P1' ? 'escalated' : t.priority === 'P2' ? 'warning' : 'information'}>
                          {t.priority} - {t.severity}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={t.status?.toLowerCase().includes('done') ? 'resolved' : 'pending'}>
                          {t.status}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {filteredTickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                        No ticket records found in portal history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NEW TICKET FORM */}
      {activeTab === 'create' && (
        <div className="max-w-2xl mx-auto rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" /> Open New Support Ticket
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Fill out incident details below for SLA calculation and AI routing.</p>
          </div>

          {successMessage && (
            <div className="p-3.5 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMessage}
            </div>
          )}

          <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Subject *</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Cannot access payment gateway portal"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none"
                >
                  <option value="P1">P1 - Urgent (4h SLA)</option>
                  <option value="P2">P2 - High (24h SLA)</option>
                  <option value="P3">P3 - Medium (72h SLA)</option>
                  <option value="P4">P4 - Low (120h SLA)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Description *</label>
              <textarea
                required
                rows={5}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Provide detailed description of the incident..."
                className="w-full rounded-lg border border-border bg-background p-3.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={submitting} className="px-5 py-2">
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Ticket
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { ProjectSelector } from './components/conversations/ProjectSelector';
import { Dashboard } from './pages/Dashboard';
import { Conversations } from './pages/Conversations';
import { Tickets } from './pages/Tickets';
import { Customers } from './pages/Customers';
import { Settings } from './pages/Settings';
import { Analytics } from './pages/Analytics';
import { TraceViewer } from './pages/TraceViewer';

import { CustomerPortal } from './pages/CustomerPortal';
import { CustomerWebApp } from './features/customer-web/CustomerWebApp';
import { MasterDataManagement } from './pages/admin/MasterDataManagement';
import { CenterIamManagement } from './components/admin/CenterIamManagement';
import { PlaneIntegrationsManagement } from './components/admin/PlaneIntegrationsManagement';
import { useProject } from './context/ProjectContext';
import { isAppTab, tabFromRoutePath, type AppTab } from './lib/navigation';
import { InlineAlert, ToastNotification, type NotificationTone } from './components/ui/Primitives';
import { TakeoverHandoffCard } from './components/ui/TakeoverHandoffCard';
import { CommandPalette } from './components/common/CommandPalette';

import MainframeLandingLogin from './features/standalone-landing/MainframeLandingLogin';
import { apiFetch } from './lib/apiFetch';
import { getSessionToken, isAuthenticated } from './lib/session';
import './App.css';
import { API_BASE_URL } from './lib/apiBaseUrl';

export interface ConversationSummary {
  id: string;
  customer: string;
  channel: string;
  status: string;
  last_message: string;
  handled_by: 'ai' | 'human';
  takeover_status?: string | null;
  human_session_expire_at?: string | null;
  assigned_pm?: string | null;
  profile_id?: string | null;
  profile_name?: string | null;
  avatar_url?: string | null;
  profile_email?: string | null;
  profile_phone?: string | null;
  company_name?: string | null;
  last_message_timestamp?: string | null;
}

interface Toast {
  id: string;
  message: string;
  type: NotificationTone;
}



function isCustomerAppRoute(): boolean {
  const path = window.location.pathname;
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0].split('?')[0];
  const customerRoutes = ['portal', 'customer', 'support', 'tickets', 'help'];
  if (customerRoutes.includes(hash)) return true;
  if (customerRoutes.some((r) => path === `/${r}` || path.startsWith(`/${r}/`))) return true;
  const role = localStorage.getItem('user_role');
  return role === 'customer';
}

function isLandingRoute(): boolean {
  if (isCustomerAppRoute()) return false;
  const path = window.location.pathname;
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  if (hash === 'landing' || hash === 'hub') return true;
  if (!hash && (path === '/' || path === '')) return true;
  return false;
}

function isLoginRoute(): boolean {
  if (isCustomerAppRoute()) return false;
  const path = window.location.pathname;
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return hash === 'login' || path === '/login';
}

function tabFromLocation(): AppTab {
  const hash = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  const fromHash = tabFromRoutePath(hash);
  if (fromHash) return fromHash;
  const fromPath = tabFromRoutePath(window.location.pathname);
  if (fromPath) return fromPath;
  const stored = localStorage.getItem('active_workspace_tab');
  return isAppTab(stored) ? stored : 'dashboard';
}

export default function App() {
  const { activeProjectId } = useProject();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [conversationUpdatedAt, setConversationUpdatedAt] = useState<Date | null>(null);
  const [isLanding, setIsLanding] = useState<boolean>(isLandingRoute);
  const [isLogin, setIsLogin] = useState<boolean>(isLoginRoute);
  const [isCustomerApp, setIsCustomerApp] = useState<boolean>(isCustomerAppRoute);
  const [activeTab, setActiveTabState] = useState<AppTab>(tabFromLocation);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [takeoverAlert, setTakeoverAlert] = useState<{ conversationId: string; customerName: string; lastMessage: string; reasonCode?: string } | null>(null);
  const [realtimeMessage, setRealtimeMessage] = useState<{ conversationId: string; sequence: number } | null>(null);
  const [targetConvId, setTargetConvId] = useState<string | null>(null);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);

  useEffect(() => {
    const handleLocationChange = () => {
      setIsCustomerApp(isCustomerAppRoute());
      setIsLanding(isLandingRoute());
      setIsLogin(isLoginRoute());
      setActiveTabState(tabFromLocation());
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const handleToggle = () => setIsCmdPaletteOpen((prev) => !prev);
    window.addEventListener('toggle-command-palette', handleToggle);
    return () => window.removeEventListener('toggle-command-palette', handleToggle);
  }, []);
  const toastTimersRef = useRef(new Map<string, number>());
  const toastKeysRef = useRef(new Set<string>());
  const conversationRequestRef = useRef(0);
  const dismissedAlertsRef = useRef(new Set<string>());
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;
  // Read by the socket handler, which must not re-subscribe every time the
  // conversation list changes.
  const conversationsRef = useRef<ConversationSummary[]>(conversations);
  conversationsRef.current = conversations;

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    setIsLanding(false);
    setIsLogin(false);
    localStorage.setItem('active_workspace_tab', tab);
    const hash = `#/${tab}`;
    if (window.location.hash !== hash) window.history.pushState({ tab }, '', hash);
  }, []);



  useEffect(() => {
    const onLocationChange = () => {
      const landing = isLandingRoute();
      const login = isLoginRoute();
      setIsLanding(landing);
      setIsLogin(login);
      if (!landing && !login) {
        setActiveTabState(tabFromLocation());
      }
    };
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => {
      const target = current.find((toast) => toast.id === id);
      if (target) toastKeysRef.current.delete(`${target.type}:${target.message}`);
      return current.filter((toast) => toast.id !== id);
    });
    const timer = toastTimersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimersRef.current.delete(id);
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const key = `${type}:${message}`;
    if (toastKeysRef.current.has(key)) return;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    toastKeysRef.current.add(key);
    setToasts((current) => [...current, { id, message, type }]);
    const timer = window.setTimeout(() => dismissToast(id), type === 'error' ? 8000 : type === 'warning' || type === 'connection' ? 6000 : 3200);
    toastTimersRef.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => () => {
    toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    toastTimersRef.current.clear();
    toastKeysRef.current.clear();
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      setBackendHealthy(response.ok);
    } catch {
      setBackendHealthy(false);
    }
  }, []);

  const fetchConversations = useCallback(async (silent = false) => {
    const requestId = ++conversationRequestRef.current;
    const projectId = activeProjectId;
    if (!silent) setConversationLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/admin/conversations?projectId=${encodeURIComponent(projectId)}`);
      if (!response.ok) throw new Error(`Conversation service returned ${response.status}`);
      const data = await response.json() as ConversationSummary[];
      if (requestId !== conversationRequestRef.current || projectId !== activeProjectIdRef.current) return;
      // Smart merge: preserve optimistic human takeover state if backend hasn't caught up yet.
      // If frontend already marked a conv as human/ACTIVE_HUMAN but backend still returns ai,
      // keep the frontend state so we don't flicker back to "Take Over" button.
      setConversations((prev) => {
        const prevMap = new Map(prev.map((c) => [c.id, c]));
        return data.map((incoming) => {
          const existing = prevMap.get(incoming.id);
          if (existing && existing.handled_by === 'human' && existing.takeover_status === 'ACTIVE_HUMAN') {
            // Case 1: Backend hasn't committed the takeover yet — preserve human status
            const preserveStatus = incoming.handled_by === 'ai';
            // Case 2: Backend already knows it's human, but human_session_expire_at is missing/null
            //         (race: fetchConversations fired before backend committed the lease timer)
            const preserveExpiry = existing.human_session_expire_at && !incoming.human_session_expire_at;
            if (preserveStatus || preserveExpiry) {
              return {
                ...incoming,
                handled_by: 'human',
                takeover_status: 'ACTIVE_HUMAN',
                // Keep whichever expiry is non-null (prefer backend's if it has one)
                human_session_expire_at: incoming.human_session_expire_at || existing.human_session_expire_at,
              };
            }
          }
          return incoming;
        });
      });
      // 100% Fail-safe: Auto-trigger TakeoverHandoffCard alert for any conversation needing human takeover
      const pendingConv = data.find(
        (c) =>
          (c.takeover_status === 'PENDING_HUMAN' || (c.handled_by === 'human' && c.takeover_status !== 'ACTIVE_HUMAN')) &&
          !dismissedAlertsRef.current.has(String(c.id))
      );
      if (pendingConv) {
        setTakeoverAlert({
          conversationId: String(pendingConv.id),
          customerName: pendingConv.profile_name || pendingConv.customer || 'Customer',
          lastMessage: pendingConv.last_message || 'Human assistance required',
          reasonCode: 'CUSTOMER_REQUESTED_HUMAN',
        });
      }
      setConversationError(null);
      setConversationUpdatedAt(new Date());
    } catch (error) {
      if (requestId !== conversationRequestRef.current || projectId !== activeProjectIdRef.current) return;
      setConversationError(error instanceof Error ? error.message : 'Conversations are unavailable');
      if (!silent) showToast('Conversations could not be refreshed. Existing data was preserved.', 'error');
    } finally {
      if (!silent && requestId === conversationRequestRef.current && projectId === activeProjectIdRef.current) {
        setConversationLoading(false);
      }
    }
  }, [activeProjectId, showToast]);

  useEffect(() => {
    ++conversationRequestRef.current;
    setConversations([]);
    setTargetConvId(null);
    setTakeoverAlert(null);
    setRealtimeMessage(null);
    setConversationError(null);
    setConversationUpdatedAt(null);
    setConversationLoading(true);
  }, [activeProjectId]);

  useEffect(() => {
    checkHealth();
    fetchConversations();
    const healthInterval = window.setInterval(checkHealth, 15000);
    const conversationInterval = window.setInterval(() => fetchConversations(true), 30000);
    return () => { window.clearInterval(healthInterval); window.clearInterval(conversationInterval); };
  }, [checkHealth, fetchConversations]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      try {
        const endpoint = new URL(API_BASE_URL);
        endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
        endpoint.pathname = '/api/admin/socket';
        endpoint.search = '';
        endpoint.searchParams.set('projectId', activeProjectId);
        const sessionToken = getSessionToken();
        if (!sessionToken) return;
        endpoint.searchParams.set('token', sessionToken);
        socket = new WebSocket(endpoint.toString());
        socket.onmessage = (event) => {
          if (disposed) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.event === 'NEW_MESSAGE') {
              setRealtimeMessage({
                conversationId: String(payload.data?.conversationId || ''),
                sequence: Date.now(),
              });
              fetchConversations(true);
              return;
            }
            if (payload.event !== 'NEW_HUMAN_REQUEST') return;
            // No conversation id means there is nothing to open. This used to
            // default to '1', which pointed the operator at an unrelated
            // conversation on any malformed event.
            const conversationId = String(payload.data?.conversationId || '');
            if (!conversationId) return;

            const known = conversationsRef.current.find((c) => String(c.id) === conversationId);
            const lastMessage = payload.data?.lastMessage || 'Human assistance required';
            setTakeoverAlert({
              conversationId,
              // The backend no longer resolves the customer's name before
              // broadcasting — holding the alert for a three-table join was
              // the point of the change. The name is already here.
              customerName: payload.data?.customerName || known?.profile_name || known?.customer || 'Customer',
              lastMessage,
              reasonCode: payload.data?.reasonCode,
            });

            if (known) {
              // Merge locally rather than refetching. The broadcast is sent
              // before the handoff row is committed, so a refetch here races
              // the write and can repaint the row as AI-handled until the 30s
              // poll corrects it.
              setConversations((prev) =>
                prev.map((c) =>
                  String(c.id) === conversationId
                    ? { ...c, handled_by: 'human', takeover_status: 'PENDING_HUMAN', last_message: lastMessage }
                    : c
                )
              );
            } else {
              // Not in the list yet — a first-contact conversation. Only this
              // case needs the round trip.
              fetchConversations(true);
            }
          } catch { /* Ignore malformed socket events without disrupting the workspace. */ }
        };
        socket.onerror = () => {};
        socket.onclose = () => { if (!disposed) reconnectTimer = window.setTimeout(connect, 5000); };
      } catch { if (!disposed) reconnectTimer = window.setTimeout(connect, 5000); }
    };
    connect();
    return () => { disposed = true; if (reconnectTimer) window.clearTimeout(reconnectTimer); socket?.close(); };
  }, [activeProjectId, fetchConversations]);

  const openConversation = useCallback((conversationId: string) => {
    setTargetConvId(conversationId);
    setActiveTab('conversations');
  }, [setActiveTab]);

  if (isCustomerApp) {
    return <CustomerWebApp />;
  }

  if (isLogin || isLanding) {
    return (
      <MainframeLandingLogin
        onLoginSuccess={() => {
          setIsLogin(false);
          setIsLanding(false);
          const role = localStorage.getItem('user_role');
          if (role === 'customer') {
            setIsCustomerApp(true);
          } else {
            setActiveTab('dashboard');
          }
        }}
      />
    );
  }

  const content = (() => {
    const userRole = localStorage.getItem('user_role') || 'employee';
    const isSuperAdmin = userRole === 'super_admin';

    switch (activeTab) {
      case 'dashboard': return <Dashboard apiBaseUrl={API_BASE_URL} conversations={conversations as any} conversationsLoading={conversationLoading} conversationsError={conversationError} conversationsUpdatedAt={conversationUpdatedAt} backendHealthy={backendHealthy} refreshConversations={() => fetchConversations(true)} onNavigate={setActiveTab} />;
      case 'conversations': return <Conversations apiBaseUrl={API_BASE_URL} conversations={conversations} setConversations={setConversations} showToast={showToast} refreshConversations={() => fetchConversations(true)} initialSelectedConvId={targetConvId} clearInitialSelectedConvId={() => setTargetConvId(null)} conversationsLoading={conversationLoading} conversationsError={conversationError} realtimeMessage={realtimeMessage} />;
      case 'tickets': return <Tickets apiBaseUrl={API_BASE_URL} showToast={showToast} />;
      case 'directory': return <Customers conversations={conversations} onOpenConversation={openConversation} loading={conversationLoading} error={conversationError} />;
      case 'center-iam': return isSuperAdmin ? <div className="p-6 sm:p-8"><CenterIamManagement /></div> : <Dashboard apiBaseUrl={API_BASE_URL} conversations={conversations as any} conversationsLoading={conversationLoading} conversationsError={conversationError} conversationsUpdatedAt={conversationUpdatedAt} backendHealthy={backendHealthy} refreshConversations={() => fetchConversations(true)} onNavigate={setActiveTab} />;
      case 'master-data': return isSuperAdmin ? <MasterDataManagement /> : <Dashboard apiBaseUrl={API_BASE_URL} conversations={conversations as any} conversationsLoading={conversationLoading} conversationsError={conversationError} conversationsUpdatedAt={conversationUpdatedAt} backendHealthy={backendHealthy} refreshConversations={() => fetchConversations(true)} onNavigate={setActiveTab} />;
      case 'analytics': return <Analytics apiBaseUrl={API_BASE_URL} />;
      case 'sla-center': return <Analytics apiBaseUrl={API_BASE_URL} />;
      case 'traces': return <TraceViewer apiBaseUrl={API_BASE_URL} defaultModule="runtime" />;
      case 'automation-flows': return <TraceViewer apiBaseUrl={API_BASE_URL} defaultModule="automation" />;
      case 'prompt-sessions': return <TraceViewer apiBaseUrl={API_BASE_URL} defaultModule="prompts" />;
      case 'handoff-audit': return <TraceViewer apiBaseUrl={API_BASE_URL} defaultModule="handoffs" />;
      case 'plane-integrations': return <div className="p-6 sm:p-8"><PlaneIntegrationsManagement /></div>;
      case 'settings': return <Settings apiBaseUrl={API_BASE_URL} onNavigate={setActiveTab} />;
      default: return <Dashboard apiBaseUrl={API_BASE_URL} conversations={conversations as any} conversationsLoading={conversationLoading} conversationsError={conversationError} conversationsUpdatedAt={conversationUpdatedAt} backendHealthy={backendHealthy} refreshConversations={() => fetchConversations(true)} onNavigate={setActiveTab} />;
    }
  })();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileOpen={mobileNavigationOpen} onMobileClose={() => setMobileNavigationOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar title={activeTab} backendHealthy={backendHealthy} conversations={conversations} onSelectNotification={openConversation} onOpenNavigation={() => setMobileNavigationOpen(true)} />
        <div className="border-b border-border px-4 py-2 sm:hidden"><ProjectSelector /></div>
        {conversationError && conversations.length > 0 && <div className="px-4 pt-3 sm:px-6 lg:px-8"><InlineAlert tone="stale" title="Conversation data may be stale">The latest refresh failed. Last successful data from {conversationUpdatedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? 'an earlier session'} remains visible.</InlineAlert></div>}
        <main id="main-content" className="min-h-0 flex-1" tabIndex={-1} aria-busy={conversationLoading}>{content}</main>
      </div>

      <div className="notification-stack" aria-live="polite" aria-relevant="additions removals">
        {takeoverAlert && (
          <TakeoverHandoffCard
            conversationId={takeoverAlert.conversationId}
            customerName={takeoverAlert.customerName}
            lastMessage={takeoverAlert.lastMessage}
            reasonCode={takeoverAlert.reasonCode}
            onAccept={() => {
              openConversation(takeoverAlert.conversationId);
              setTakeoverAlert(null);
            }}
            onDismiss={() => {
              if (takeoverAlert?.conversationId) {
                dismissedAlertsRef.current.add(takeoverAlert.conversationId);
              }
              setTakeoverAlert(null);
            }}
          />
        )}
        {toasts.map((toast) => <ToastNotification key={toast.id} tone={toast.type} message={toast.message} onDismiss={() => dismissToast(toast.id)} />)}
      </div>

      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        onNavigateTab={setActiveTab}
      />
    </div>
  );
}


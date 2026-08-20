import { Activity, BarChart3, Bot, Building2, Clock3, Home, MessageSquare, RefreshCw, Send, Settings, Shield, ShieldCheck, Sparkles, Ticket, Users, Zap } from 'lucide-react';

export const appNavigation = [
  { id: 'dashboard', label: 'Mission Control', icon: Home, group: 'WORK' },
  { id: 'conversations', label: 'Inbox', icon: MessageSquare, group: 'WORK' },
  { id: 'tickets', label: 'Tickets', icon: Ticket, group: 'WORK' },
  { id: 'portal', label: 'Customer Portal', icon: ShieldCheck, group: 'WORK' },
  { id: 'directory', label: 'Customer Directory', icon: Users, group: 'CUSTOMERS' },
  { id: 'center-iam', label: 'Center IAM Console', icon: Shield, group: 'CUSTOMERS' },
  { id: 'master-data', label: 'Master Data Explorer', icon: Building2, group: 'CUSTOMERS' },
  { id: 'traces', label: 'Agent Runtime', icon: Activity, group: 'OPERATIONS' },
  { id: 'automation-flows', label: 'Workflow Operations', icon: Zap, group: 'OPERATIONS' },
  { id: 'prompt-sessions', label: 'Prompt Sessions', icon: Sparkles, group: 'OPERATIONS' },
  { id: 'handoff-audit', label: 'Human Handoffs', icon: RefreshCw, group: 'OPERATIONS' },
  { id: 'analytics', label: 'Reports', icon: BarChart3, group: 'INSIGHTS' },
  { id: 'sla-center', label: 'SLA Center', icon: Clock3, group: 'INSIGHTS' },
  { id: 'plane-integrations', label: 'Plane Integrations', icon: Send, group: 'SYSTEM' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'SYSTEM' },
] as const;

export type AppTab = (typeof appNavigation)[number]['id'];

export const routeToTabMap: Record<string, AppTab> = {
  'dashboard': 'dashboard',
  'mission-control': 'dashboard',
  'home': 'dashboard',
  'conversations': 'conversations',
  'inbox': 'conversations',
  'tickets': 'tickets',
  'portal': 'portal',
  'customer-portal': 'portal',
  'customers': 'directory',
  'customer-directory': 'directory',
  'directory': 'directory',
  'center-iam': 'center-iam',
  'center': 'center-iam',
  'iam': 'center-iam',
  'master-data': 'master-data',
  'masterdata': 'master-data',
  'organizations': 'master-data',
  'analytics': 'analytics',
  'reports': 'analytics',
  'sla-center': 'sla-center',
  'automation-traces': 'traces',
  'traces': 'traces',
  'agent-runtime': 'traces',
  'automation-flows': 'automation-flows',
  'workflow-operations': 'automation-flows',
  'prompt-sessions': 'prompt-sessions',
  'handoff-audit': 'handoff-audit',
  'human-handoffs': 'handoff-audit',
  'plane-integrations': 'plane-integrations',
  'plane': 'plane-integrations',
  'plane-management': 'plane-integrations',
  'settings': 'settings',
  'app': 'dashboard',
};

export function tabFromRoutePath(path: string): AppTab | null {
  const normalized = path.replace(/^\/|#\/?/g, '').split('/')[0].toLowerCase();
  if (!normalized) return null;
  return routeToTabMap[normalized] ?? (isAppTab(normalized) ? normalized : null);
}

export function isAppTab(value: string | null | undefined): value is AppTab {
  return appNavigation.some((item) => item.id === value);
}

export function getTabLabel(tab: AppTab) {
  return appNavigation.find((item) => item.id === tab)?.label ?? tab;
}

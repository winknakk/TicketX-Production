import { useState } from 'react';
import { ConversationProvider, type Conversation } from '../context/ConversationContext';
import { SidebarInbox } from '../components/conversations/SidebarInbox';
import { ChatArea } from '../components/conversations/ChatArea';
import { CRMWorkspace } from '../components/conversations/CRMWorkspace';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { cn } from '../lib/utils';
import { useProject } from '../context/ProjectContext';

interface ConversationsProps {
  apiBaseUrl: string;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  showToast: (message: string, type?: 'success' | 'error' | 'takeover' | 'bot') => void;
  refreshConversations?: () => void;
  initialSelectedConvId?: string | null;
  clearInitialSelectedConvId?: () => void;
  conversationsLoading?: boolean;
  conversationsError?: string | null;
  realtimeMessage?: { conversationId: string; sequence: number } | null;
}

type MobileView = 'queue' | 'thread' | 'context';

export function Conversations(props: ConversationsProps) {
  const { activeProjectId } = useProject();
  const [mobileView, setMobileView] = useState<MobileView>(props.initialSelectedConvId ? 'thread' : 'queue');
  return (
    <ConversationProvider key={activeProjectId} {...props}>
      <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 flex-col overflow-hidden p-0 sm:h-[calc(100dvh-3.5rem)] sm:px-4 sm:py-3 lg:px-6 lg:py-4">
        <div className="relative flex min-h-0 flex-1 overflow-hidden border-y border-border bg-card sm:border">
          <ErrorBoundary>
            <SidebarInbox className={cn(mobileView === 'queue' ? 'flex' : 'hidden', 'md:flex')} onCustomerSelected={() => setMobileView('thread')} loading={props.conversationsLoading} error={props.conversationsError} />
          </ErrorBoundary>
          <ErrorBoundary>
            <ChatArea className={cn(mobileView === 'thread' ? 'flex' : 'hidden', 'md:flex')} onBack={() => setMobileView('queue')} onOpenContext={() => setMobileView('context')} />
          </ErrorBoundary>
          <ErrorBoundary>
            <CRMWorkspace className={cn(mobileView === 'context' ? 'absolute inset-0 z-20 flex' : 'hidden', 'xl:static xl:flex')} onClose={() => setMobileView('thread')} />
          </ErrorBoundary>
        </div>
      </div>
    </ConversationProvider>
  );
}

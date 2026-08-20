import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useProject } from './ProjectContext';
import { getOperatorProfile } from '../lib/operator';
import { apiFetch } from '../lib/apiFetch';


export interface Conversation {
  id: string;
  customer: string;
  channel: string;
  status: string;
  last_message: string;
  handled_by: 'ai' | 'human';
  takeover_status?: string | null;
  human_session_expire_at?: string | null;
  profile_id?: string | null;
  profile_name?: string | null;
  avatar_url?: string | null;
  profile_email?: string | null;
  profile_phone?: string | null;
  company_name?: string | null;
  last_message_timestamp?: string | null;
}

export interface Message {
  id?: string | number;
  role: 'customer' | 'ai' | 'human' | 'system';
  content: string;
  messageType?: string;
  message_type?: string;
  timestamp: string | null;
  reply_to_message_id?: number | string | null;
  replyToMessageId?: number | string | null;
  sender_name?: string;
  operator_name?: string;
  attachments?: {
    id: number | string;
    fileUrl: string;
    thumbnailUrl?: string;
    fileName: string;
    fileType: string;
    fileSize?: number;
    storageKey?: string;
  }[];
}


export interface Ticket {
  id1?: string;
  id?: string;
  ticketId?: string;
  ticket_id?: string;
  conversation_id: string;
  subject: string;
  summary: string;
  status: string;
  priority: string;
  severity: string;
  created_by_type?: string;
  createdByType?: string;
  created_by_name?: string;
  createdByName?: string;
  cancellation_reason?: string;
  cancellationReason?: string;
  planeIssueId?: string | null;
  plane_issue_id?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
}

interface ConversationContextType {
  apiBaseUrl: string;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  selectedConvId: string | null;
  setSelectedConvId: (id: string | null) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  activeChannelTab: string;
  setActiveChannelTab: (tab: string) => void;
  messages: Message[];
  tickets: Ticket[];
  filterTab: 'all' | 'ai' | 'human' | 'pending';
  setFilterTab: (tab: 'all' | 'ai' | 'human' | 'pending') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  replyingToMessage: Message | null;
  setReplyingToMessage: (msg: Message | null) => void;
  isLoadingMessages: boolean;
  isSendingReply: boolean;
  isTakingOver: boolean;
  isReleasing: boolean;
  isCreatingTicket: boolean;
  isPromotingTicket: string | null;
  profileData: any;
  isLoadingProfile: boolean;
  profileError: string | null;
  isCrmCollapsed: boolean;
  setIsCrmCollapsed: (collapsed: boolean) => void;
  remainingTime: string;
  ticketSubject: string;
  setTicketSubject: (sub: string) => void;
  ticketSummary: string;
  setTicketSummary: (sum: string) => void;
  ticketPriority: string;
  setTicketPriority: (pri: string) => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  
  // Actions
  fetchMessages: (convId: string) => Promise<void>;
  fetchTickets: (convId: string) => Promise<void>;
  fetchProfile: (convId: string) => Promise<void>;
  handleTakeover: (convId: string) => Promise<void>;
  handleRelease: (convId: string, automaticRelease?: boolean) => Promise<void>;
  handleSendReply: () => Promise<void>;
  handleSendImageReply: (fileOrFiles: File | File[], caption?: string) => Promise<void>;
  handleCreateTicket: (e: React.FormEvent) => Promise<void>;
  handlePromoteTicket: (ticketId: string) => Promise<void>;
  isConversationUnread: (c: Conversation) => boolean;
  getConversationPriority: (c: Conversation) => string;
  getTimelineItems: () => any[];
  customers: any[];
  sortedCustomers: any[];
  showToast: (message: string, type?: 'success' | 'error' | 'takeover' | 'bot') => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
  apiBaseUrl: string;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  showToast: (message: string, type?: 'success' | 'error' | 'takeover' | 'bot') => void;
  refreshConversations?: () => void;
  initialSelectedConvId?: string | null;
  clearInitialSelectedConvId?: () => void;
  realtimeMessage?: { conversationId: string; sequence: number } | null;
}

export const ConversationProvider: React.FC<ProviderProps> = ({
  children,
  apiBaseUrl,
  conversations,
  setConversations,
  showToast,
  refreshConversations,
  initialSelectedConvId,
  clearInitialSelectedConvId,
  realtimeMessage
}) => {
  const { activeProjectId } = useProject();

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [activeChannelTab, setActiveChannelTab] = useState<string>('line');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  
  const [filterTab, setFilterTab] = useState<'all' | 'ai' | 'human' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [replyText, setReplyText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isPromotingTicket, setIsPromotingTicket] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isCrmCollapsed, setIsCrmCollapsed] = useState(true);
  const [remainingTime, setRemainingTime] = useState<string>('');

  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketSummary, setTicketSummary] = useState('');
  const [ticketPriority, setTicketPriority] = useState('');
  
  const [readStates, setReadStates] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_read_states') || '{}');
    } catch {
      return {};
    }
  });

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const shouldScrollToBottomRef = useRef(false);
  const releaseInFlightRef = useRef<string | null>(null);
  const activeProjectIdRef = useRef(activeProjectId);
  const selectedConvIdRef = useRef(selectedConvId);
  activeProjectIdRef.current = activeProjectId;
  selectedConvIdRef.current = selectedConvId;

  // Helper: schedule a scroll to bottom after next render
  const scrollToBottom = (smooth = false) => {
    shouldScrollToBottomRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = chatContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: smooth ? 'smooth' : 'instant' as ScrollBehavior
          });
        }
        shouldScrollToBottomRef.current = false;
      });
    });
  };

  // Fetch messages with optional project scoping
  const fetchMessages = async (convId: string, isSilent = false) => {
    const projectId = activeProjectId;
    if (!isSilent) setIsLoadingMessages(true);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${convId}/messages?projectId=${projectId}`);
      if (projectId !== activeProjectIdRef.current || convId !== selectedConvIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        let senderCache: Record<string, string> = {};
        try {
          senderCache = JSON.parse(localStorage.getItem('operator_message_senders') || '{}');
        } catch {}

        const enrichedData = (data || []).map((msg: any) => {
          if (msg.role === 'human' || msg.role === 'operator') {
            const key = `${convId}:${msg.content}`;
            const cachedSender = senderCache[key] || senderCache[msg.id];
            return {
              ...msg,
              sender_name: msg.sender_name || msg.operator_name || cachedSender || undefined,
            };
          }
          return msg;
        });

        setMessages((prev) => {
          if (prev.length === enrichedData.length && JSON.stringify(prev) === JSON.stringify(enrichedData)) {
            return prev;
          }
          return enrichedData;
        });
        if (data.length > 0) {
          const lastMsg = data[data.length - 1];
          if (lastMsg && lastMsg.timestamp) {
            setReadStates((prev) => {
              const next = { ...prev, [convId]: lastMsg.timestamp };
              localStorage.setItem('crm_read_states', JSON.stringify(next));
              return next;
            });
          }
        }
      } else {
        if (!isSilent) showToast('Failed to fetch conversation history', 'error');
      }
    } catch (e) {
      if (!isSilent && projectId === activeProjectIdRef.current && convId === selectedConvIdRef.current) {
        showToast('Error loading messages', 'error');
      }
    } finally {
      if (!isSilent && projectId === activeProjectIdRef.current && convId === selectedConvIdRef.current) {
        setIsLoadingMessages(false);
      }
    }
  };


  // Fetch tickets with optional project scoping
  const fetchTickets = async (convId: string) => {
    const projectId = activeProjectId;
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${convId}/tickets?projectId=${projectId}`);
      if (projectId !== activeProjectIdRef.current || convId !== selectedConvIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error('Error fetching tickets:', e);
    }
  };

  // Fetch profile details
  const fetchProfile = async (convId: string) => {
    const projectId = activeProjectId;
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${convId}/profile?projectId=${projectId}`);
      if (projectId !== activeProjectIdRef.current || convId !== selectedConvIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        if (data?.identity) {
          const avatarUrl = data.identity.avatar_url || null;
          const profileName = data.identity.profile_name && data.identity.profile_name !== '-' ? data.identity.profile_name : null;
          const profileEmail = data.identity.email && data.identity.email !== '-' ? data.identity.email : null;
          const profilePhone = data.identity.phone && data.identity.phone !== '-' ? data.identity.phone : null;
          
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    avatar_url: avatarUrl || c.avatar_url,
                    profile_name: profileName || c.profile_name,
                    profile_email: profileEmail || c.profile_email,
                    profile_phone: profilePhone || c.profile_phone,
                  }
                : c
            )
          );
        }
      } else {
        setProfileData(null);
        setProfileError('Customer profile is unavailable for this project.');
      }
    } catch (e) {
      if (projectId !== activeProjectIdRef.current || convId !== selectedConvIdRef.current) return;
      console.error('Error fetching profile:', e);
      setProfileData(null);
      setProfileError('Customer profile could not be loaded.');
    } finally {
      if (projectId === activeProjectIdRef.current && convId === selectedConvIdRef.current) {
        setIsLoadingProfile(false);
      }
    }
  };

  // Take over room
  const handleTakeover = async (convId: string) => {
    setIsTakingOver(true);
    const OPTIMISTIC_TIMEOUT_MS = 15 * 60 * 1000;
    const optimisticExpireAt = new Date(Date.now() + OPTIMISTIC_TIMEOUT_MS).toISOString();

    // Optimistic update: immediately show Human mode + timer
    setConversations((prev) =>
      prev.map((c) => (
        c.id === convId
          ? {
              ...c,
              handled_by: 'human',
              takeover_status: 'ACTIVE_HUMAN',
              human_session_expire_at: c.human_session_expire_at || optimisticExpireAt,
            }
          : c
      ))
    );
    setFilterTab('human');

    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${convId}/takeover?projectId=${activeProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const result = await res.json();
        showToast('Takeover successful! You are now handling this room.', 'takeover');
        setConversations((prev) =>
          prev.map((c) => (
            c.id === convId
              ? {
                  ...c,
                  handled_by: 'human',
                  takeover_status: result.takeover_status || 'ACTIVE_HUMAN',
                  human_session_expire_at: result.human_session_expire_at || optimisticExpireAt,
                }
              : c
          ))
        );
        await fetchMessages(convId, true);
        scrollToBottom();
      } else {
        showToast('Takeover failed', 'error');
        // Revert on failure
        setConversations((prev) =>
          prev.map((c) => (
            c.id === convId
              ? { ...c, handled_by: 'ai', takeover_status: 'ACTIVE_AI', human_session_expire_at: null }
              : c
          ))
        );
      }
    } catch (e) {
      showToast('Error triggering takeover', 'error');
      // Revert on network error
      setConversations((prev) =>
        prev.map((c) => (
          c.id === convId
            ? { ...c, handled_by: 'ai', takeover_status: 'ACTIVE_AI', human_session_expire_at: null }
            : c
        ))
      );
    } finally {
      setIsTakingOver(false);
    }
  };

  // Release control to AI
  const handleRelease = async (convId: string, automaticRelease = false) => {
    if (releaseInFlightRef.current === convId) return;

    releaseInFlightRef.current = convId;
    setIsReleasing(true);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${convId}/release?projectId=${activeProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(automaticRelease ? 'Lease expired. Reverted to AI.' : 'Control returned to AI successfully.', 'bot');
        setRemainingTime('');
        setConversations((prev) =>
          prev.map((c) => (
            c.id === convId
              ? {
                  ...c,
                  handled_by: 'ai',
                  takeover_status: result.takeover_status || 'ACTIVE_AI',
                  human_session_expire_at: null,
                }
              : c
          ))
        );
        setFilterTab('ai');
        refreshConversations?.();
      } else {
        showToast('Failed to return control to AI', 'error');
      }
    } catch (e) {
      showToast('Error returning control to AI', 'error');
    } finally {
      if (releaseInFlightRef.current === convId) {
        releaseInFlightRef.current = null;
      }
      setIsReleasing(false);
    }
  };

  // Send Operator Response message
  const handleSendReply = async () => {
    if (!selectedConvId || !replyText.trim()) return;
    setIsSendingReply(true);

    const msgToSend = replyText.trim();
    const replyToId = replyingToMessage?.id ? parseInt(String(replyingToMessage.id), 10) : undefined;
    const currentOperator = getOperatorProfile(activeProjectId).name;

    const originalText = replyText;
    setReplyText('');
    setReplyingToMessage(null);

    // Save operator sender name to cache
    try {
      const cache = JSON.parse(localStorage.getItem('operator_message_senders') || '{}');
      cache[`${selectedConvId}:${msgToSend}`] = currentOperator;
      localStorage.setItem('operator_message_senders', JSON.stringify(cache));
    } catch {}

    // Optimistic update: immediately show Human mode + timer before network response
    const convIdSnapshot = selectedConvId;
    // Calculate optimistic session expiry (matches backend HUMAN_ACTIVE_TIMEOUT_MINUTES=15)
    // This makes the countdown timer appear instantly; backend will correct on next poll if needed
    const OPTIMISTIC_TIMEOUT_MS = 15 * 60 * 1000;
    const optimisticExpireAt = new Date(Date.now() + OPTIMISTIC_TIMEOUT_MS).toISOString();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convIdSnapshot
          ? {
              ...c,
              handled_by: 'human',
              takeover_status: 'ACTIVE_HUMAN',
              last_message: msgToSend,
              // Keep existing expiry if already in human mode (continuing session), else set new optimistic one
              human_session_expire_at: c.human_session_expire_at || optimisticExpireAt,
            }
          : c
      )
    );

    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${convIdSnapshot}/reply?projectId=${activeProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: msgToSend,
          reply_to_message_id: replyToId,
          sender_name: currentOperator,
          operator_name: currentOperator,
        }),
      });
      if (res.ok) {
        showToast('Reply sent successfully.');
        // Update session expiry from response so timer starts immediately (no need to wait for poll)
        try {
          const responseData = await res.json();
          if (responseData?.human_session_expire_at) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convIdSnapshot
                  ? { ...c, human_session_expire_at: responseData.human_session_expire_at }
                  : c
              )
            );
          }
        } catch {}
        await fetchMessages(convIdSnapshot, true);
        scrollToBottom(true);
      } else {
        // Revert optimistic update on failure
        showToast('Failed to send reply', 'error');
        setReplyText(originalText);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convIdSnapshot
              ? { ...c, handled_by: 'ai', takeover_status: 'ACTIVE_AI' }
              : c
          )
        );
      }
    } catch (e) {
      // Revert optimistic update on network error
      showToast('Error sending reply', 'error');
      setReplyText(originalText);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convIdSnapshot
            ? { ...c, handled_by: 'ai', takeover_status: 'ACTIVE_AI' }
            : c
        )
      );
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSendImageReply = async (fileOrFiles: File | File[], caption?: string) => {
    if (!selectedConvId) return;
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (files.length === 0) return;
    setIsSendingReply(true);
    const currentOperator = getOperatorProfile(activeProjectId).name;

    const OPTIMISTIC_TIMEOUT_MS = 15 * 60 * 1000;
    const optimisticExpireAt = new Date(Date.now() + OPTIMISTIC_TIMEOUT_MS).toISOString();

    try {
      let isFirst = true;
      for (const file of files) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadRes = await apiFetch(`${apiBaseUrl}/api/admin/media/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            base64Data,
          }),
        });

        if (!uploadRes.ok) {
          showToast(`Failed to upload image: ${file.name}`, 'error');
          continue;
        }

        const { fileUrl, storageKey: uploadedStorageKey, fileName: uploadedFileName } = await uploadRes.json();

        // Cache image reply sender name
        try {
          const cache = JSON.parse(localStorage.getItem('operator_message_senders') || '{}');
          cache[`${selectedConvId}:Attached Image`] = currentOperator;
          if (caption && isFirst) cache[`${selectedConvId}:${caption}`] = currentOperator;
          localStorage.setItem('operator_message_senders', JSON.stringify(cache));
        } catch {}

        await apiFetch(`${apiBaseUrl}/api/admin/conversations/${selectedConvId}/send-image?projectId=${activeProjectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: fileUrl,
            storageKey: uploadedStorageKey,
            fileName: uploadedFileName || file.name,
            reply_to_message_id: replyingToMessage?.id || undefined,
            caption: isFirst ? caption || undefined : undefined,
            sender_name: currentOperator,
            operator_name: currentOperator,
          }),
        });
        isFirst = false;
      }

      showToast(files.length > 1 ? `${files.length} images sent successfully.` : 'Image sent to customer successfully.');
      setReplyingToMessage(null);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConvId
            ? {
                ...c,
                handled_by: 'human',
                takeover_status: 'ACTIVE_HUMAN',
                human_session_expire_at: c.human_session_expire_at || optimisticExpireAt,
              }
            : c
        )
      );
      await fetchMessages(selectedConvId, true);
      scrollToBottom(true);
    } catch (e: any) {
      showToast(`Error sending images: ${e.message}`, 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Create Ticket via tool mock
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !ticketSubject.trim() || !ticketSummary.trim()) return;
    setIsCreatingTicket(true);
    try {
      const matched = profileData?.project?.priorities?.find((p: any) => p.code === ticketPriority);
      const severity = matched ? matched.name : 'Low';

      const currentOperator = getOperatorProfile(activeProjectId).name;
      const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations/${selectedConvId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticketSubject,
          summary: ticketSummary,
          severity,
          priority: ticketPriority,
          projectId: activeProjectId,
          created_by_type: 'HUMAN_AGENT',
          created_by_name: currentOperator,
          operator_name: currentOperator,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        showToast('Ticket created successfully!');
        setTicketSubject('');
        setTicketSummary('');
        fetchTickets(selectedConvId);
      } else {
        showToast(data.error || data.message || 'Failed to create ticket', 'error');
      }
    } catch (e) {
      showToast('Error creating ticket', 'error');
    } finally {
      setIsCreatingTicket(false);
    }
  };

  // Promote Ticket to Plane.io
  const handlePromoteTicket = async (ticketId: string) => {
    setIsPromotingTicket(ticketId);
    try {
      const res = await apiFetch(`${apiBaseUrl}/api/admin/tickets/${ticketId}/promote?projectId=${activeProjectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Promoted to Plane! Issue ID: ${result.plane_issue_id || 'mock-id'}`);
        if (selectedConvId) {
          fetchTickets(selectedConvId);
        }
      } else {
        showToast('Failed to promote ticket to Plane', 'error');
      }
    } catch (e) {
      showToast('Error promoting ticket', 'error');
    } finally {
      setIsPromotingTicket(null);
    }
  };

  // Check if a conversation has unread customer messages
  const isConversationUnread = (c: Conversation) => {
    if (c.id === selectedConvId) return false;
    if ((c as any).last_message_role !== 'customer') return false;
    if (!(c as any).last_message_timestamp) return false;
    
    const lastRead = readStates[c.id];
    if (!lastRead) return true;
    
    return new Date((c as any).last_message_timestamp) > new Date(lastRead);
  };

  // Get conversation priority status
  const getConversationPriority = (c: Conversation) => {
    const severity = (c as any).max_ticket_severity || 'Low';
    const isUnread = isConversationUnread(c);

    if (severity === 'Critical' || severity === 'High') {
      return 'Urgent';
    }

    if (isUnread && (c as any).last_message_timestamp) {
      const lastTime = new Date((c as any).last_message_timestamp).getTime();
      const now = Date.now();
      const waitMinutes = (now - lastTime) / 60000;
      if (waitMinutes > 15) {
        return 'Urgent';
      }
      return 'Waiting';
    }

    if ((c as any).last_message_role === 'customer' && c.handled_by === 'ai') {
      return 'Waiting';
    }

    return 'Normal';
  };

  // Compile timeline items
  const getTimelineItems = () => {
    const items: any[] = [];
    messages.forEach((m) => {
      const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
      const displayTime = `${dateStr} ${timeStr}`;

      if (m.role === 'customer') {
        items.push({
          time: displayTime,
          title: 'Customer Message',
          description: m.content,
          dotColor: 'border-blue-500 bg-blue-500',
          rawTime: m.timestamp || '',
        });
      } else if (m.role === 'ai') {
        items.push({
          time: displayTime,
          title: 'AI Reply',
          description: m.content,
          dotColor: 'border-primary bg-primary',
          rawTime: m.timestamp || '',
        });
      } else if (m.role === 'human') {
        items.push({
          time: displayTime,
          title: 'Operator Reply',
          description: m.content,
          dotColor: 'border-emerald-500 bg-emerald-500',
          rawTime: m.timestamp || '',
        });
      } else if (m.role === 'system') {
        items.push({
          time: displayTime,
          title: 'System Event',
          description: m.content,
          dotColor: 'border-amber-500 bg-amber-500',
          rawTime: m.timestamp || '',
        });
      }
    });

    tickets.forEach((t) => {
      const ticketTime = t.createdAt || t.created_at || new Date().toISOString();
      const timeStr = new Date(ticketTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = new Date(ticketTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const displayTime = `${dateStr} ${timeStr}`;

      items.push({
        time: displayTime,
        title: `Ticket Created (#${t.ticketId || t.ticket_id || t.id})`,
        description: `Subject: ${t.subject}\nSeverity: ${t.severity}`,
        dotColor: 'border-purple-500 bg-purple-500',
        rawTime: ticketTime,
      });

      const isPromoted = t.planeIssueId || t.plane_issue_id;
      if (isPromoted) {
        items.push({
          time: displayTime,
          title: 'Ticket Promoted',
          description: `Ticket #${t.ticketId || t.ticket_id || t.id} promoted to Plane Issue: ${isPromoted}`,
          dotColor: 'border-indigo-500 bg-indigo-500',
          rawTime: ticketTime,
        });
      }
    });

    return items.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());
  };

  // Group conversations into Customers
  const customers = React.useMemo(() => {
    const customerMap: Record<string, any> = {};

    conversations.forEach((c) => {
      // Filter out rooms that don't have any chat messages yet
      const hasChatContent = Boolean(
        (c.last_message && c.last_message.trim() !== '') ||
        c.last_message_timestamp ||
        (c as any).message_count > 0 ||
        (c as any).messages?.length > 0 ||
        (c as any).message_contents
      );
      if (!hasChatContent) return;

      const profId = c.profile_id && c.profile_id !== 'unknown' ? c.profile_id : (c.customer || 'unknown');
      const channelName = String(c.channel || 'line').toLowerCase();
      const priorityVal = getConversationPriority(c);

      if (!customerMap[profId]) {
        customerMap[profId] = {
          id: profId,
          name: c.profile_name || c.customer,
          company: c.company_name || '--',
          avatarUrl: c.avatar_url || null,
          email: c.profile_email || null,
          phone: c.profile_phone || null,
          conversations: {},
          unread_count: 0,
          priority: 'Normal',
          latest_timestamp: null,
        };
      }

      const cust = customerMap[profId];
      cust.conversations[channelName] = c;

      if (isConversationUnread(c)) {
        cust.unread_count += 1;
      }

      const priorityWeights = { Urgent: 3, Waiting: 2, Normal: 1 };
      const currentWeight = priorityWeights[cust.priority as 'Urgent' | 'Waiting' | 'Normal'] || 1;
      const newWeight = priorityWeights[priorityVal] || 1;
      if (newWeight > currentWeight) {
        cust.priority = priorityVal;
      }

      const ts = c.last_message_timestamp || (c as any).created_at;
      if (ts) {
        if (!cust.latest_timestamp || new Date(ts).getTime() > new Date(cust.latest_timestamp).getTime()) {
          cust.latest_timestamp = ts;
        }
      }
    });

    return Object.values(customerMap);
  }, [conversations, readStates, selectedConvId]);

  const sortedCustomers = React.useMemo(() => {
    return [...customers].sort((a, b) => {
      const timeA = a.latest_timestamp ? new Date(a.latest_timestamp).getTime() : 0;
      const timeB = b.latest_timestamp ? new Date(b.latest_timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [customers]);

  // Project changes must invalidate every room-specific state immediately.
  useEffect(() => {
    setSelectedConvId(null);
    setSelectedCustomerId(null);
    setActiveChannelTab('line');
    setMessages([]);
    setTickets([]);
    setProfileData(null);
    setProfileError(null);
    setReplyText('');
    setReplyingToMessage(null);
    setRemainingTime('');
    setIsLoadingMessages(false);
    setIsLoadingProfile(false);
    isInitialLoadRef.current = true;
  }, [activeProjectId]);

  // Auto-select first customer if none selected or if selected customer does not exist in current project
  useEffect(() => {
    if (sortedCustomers.length > 0) {
      const exists = selectedCustomerId && sortedCustomers.some((c) => c.id === selectedCustomerId);
      if (!exists) {
        setSelectedCustomerId(sortedCustomers[0].id);
      }
    } else if (selectedCustomerId) {
      setSelectedCustomerId(null);
    }
  }, [sortedCustomers, selectedCustomerId]);

  // Synchronize activeConversationId (selectedConvId) with selected customer & tab
  useEffect(() => {
    const selectedCustomer = customers.find(cust => cust.id === selectedCustomerId);
    if (selectedCustomer) {
      let activeConv = selectedCustomer.conversations[activeChannelTab];
      if (!activeConv) {
        // If the current tab has no conversation, but other channels do, automatically switch to the first active channel!
        const availableChannels = Object.keys(selectedCustomer.conversations);
        if (availableChannels.length > 0) {
          const firstChannel = availableChannels[0];
          setActiveChannelTab(firstChannel);
          activeConv = selectedCustomer.conversations[firstChannel];
        }
      }

      if (activeConv) {
        setSelectedConvId(activeConv.id);
      } else {
        setSelectedConvId(null);
      }
    } else {
      setSelectedConvId(null);
    }
  }, [selectedCustomerId, activeChannelTab, customers]);

  // On active conversation change, load messages & tickets
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      fetchTickets(selectedConvId);
      
      const selectedConv = conversations.find(c => c.id === selectedConvId);
      if (selectedConv) {
        const lastMsg = selectedConv.last_message || "";
        const channelName = (selectedConv.channel || "line").toUpperCase();
        setTicketSubject(`IT support requested: ${lastMsg.slice(0, 30)}...`);
        setTicketSummary(`User reported issue: "${lastMsg}" on channel ${channelName}`);
      }
    } else {
      setMessages([]);
      setTickets([]);
    }
  }, [selectedConvId, activeProjectId]);

  // Synchronize initialSelectedConvId from prop redirect (Human Takeover alert click)
  useEffect(() => {
    if (initialSelectedConvId) {
      const conv = conversations.find(c => c.id === initialSelectedConvId);
      if (conv) {
        setSelectedCustomerId(conv.profile_id || conv.customer);
        setSelectedConvId(conv.id);
        setActiveChannelTab(conv.channel.toLowerCase());
      }
      if (clearInitialSelectedConvId) {
        clearInitialSelectedConvId();
      }
    }
  }, [initialSelectedConvId, conversations]);

  // Sync ticket default priority when project/profile loaded
  useEffect(() => {
    if (profileData && profileData.project) {
      const projectPriorities = profileData.project.priorities || [];
      const codes = projectPriorities.map((p: any) => p.code);
      if (codes.length > 0) {
        if (!codes.includes(ticketPriority)) {
          setTicketPriority(profileData.project.defaultPriority || codes[0]);
        }
      }
    }
  }, [profileData]);

  // Reset initial load flag
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [selectedConvId, activeProjectId]);

  // Poll messages silently every 5 seconds without triggering loading states
  useEffect(() => {
    if (!selectedConvId) return;

    const interval = setInterval(() => {
      fetchMessages(selectedConvId, true);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedConvId, activeProjectId]);

  // A Project-scoped socket event refreshes the open room immediately.
  useEffect(() => {
    if (selectedConvId && realtimeMessage?.conversationId === selectedConvId) {
      fetchMessages(selectedConvId, true);
    }
  }, [realtimeMessage?.sequence, selectedConvId, activeProjectId]);

  // Countdown timer for human takeover lease
  useEffect(() => {
    const selectedConversation = conversations.find(c => c.id === selectedConvId);
    if (
      !selectedConversation
      || selectedConversation.handled_by !== 'human'
      || selectedConversation.takeover_status !== 'ACTIVE_HUMAN'
      || !selectedConversation.human_session_expire_at
    ) {
      setRemainingTime('');
      return;
    }

    const updateTimer = () => {
      const expireTime = new Date(selectedConversation.human_session_expire_at!).getTime();
      const now = Date.now();
      const diffMs = expireTime - now;
 
      if (diffMs <= 0) {
        setRemainingTime('');
        handleRelease(selectedConversation.id, true);
        return;
      }

      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0 || hours > 0) parts.push(`${mins}m`);
      parts.push(`${secs}s`);

      setRemainingTime(parts.join(' ') + ' left');
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [selectedConvId, conversations]);

  // Smart Auto-scroll: Scroll to bottom on initial load and when near bottom
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container || messages.length === 0) return;

    const scrollToBottomNow = (behavior: ScrollBehavior = 'instant') => {
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior });
      }
    };

    if (isInitialLoadRef.current) {
      requestAnimationFrame(() => {
        scrollToBottomNow('instant');
        setTimeout(() => scrollToBottomNow('instant'), 100);
        setTimeout(() => scrollToBottomNow('instant'), 350);
      });
      isInitialLoadRef.current = false;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      scrollToBottomNow('smooth');
      setTimeout(() => scrollToBottomNow('smooth'), 150);
      shouldScrollToBottomRef.current = false;
      return;
    }

    // Follow new messages smoothly if user is within 30px of bottom (at the bottom)
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 30) {
      requestAnimationFrame(() => {
        scrollToBottomNow('smooth');
      });
    }
  }, [messages]);


  return (
    <ConversationContext.Provider
      value={{
        apiBaseUrl,
        conversations,
        setConversations,
        selectedConvId,
        setSelectedConvId,
        selectedCustomerId,
        setSelectedCustomerId,
        activeChannelTab,
        setActiveChannelTab,
        messages,
        tickets,
        filterTab,
        setFilterTab,
        searchQuery,
        setSearchQuery,
        replyText,
        setReplyText,
        replyingToMessage,
        setReplyingToMessage,
        isLoadingMessages,
        isSendingReply,
        isTakingOver,
        isReleasing,
        isCreatingTicket,
        isPromotingTicket,
        profileData,
        isLoadingProfile,
        profileError,
        isCrmCollapsed,
        setIsCrmCollapsed,
        remainingTime,
        ticketSubject,
        setTicketSubject,
        ticketSummary,
        setTicketSummary,
        ticketPriority,
        setTicketPriority,
        chatContainerRef,
        messagesEndRef,
        
        fetchMessages,
        fetchTickets,
        fetchProfile,
        handleTakeover,
        handleRelease,
        handleSendReply,
        handleSendImageReply,
        handleCreateTicket,
        handlePromoteTicket,
        isConversationUnread,
        getConversationPriority,
        getTimelineItems,
        customers,
        sortedCustomers,
        showToast
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used inside a ConversationProvider');
  }
  return context;
};

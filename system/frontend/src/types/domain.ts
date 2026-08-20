/**
 * 8-Tier Authoritative Domain Model for TicketX / AutomationX V3
 * Workspace -> Project -> Company -> Profile -> Identity -> Conversation -> Message -> Ticket
 */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  environment: 'production' | 'staging' | 'demo';
  projectType?: string;
  createdAt?: string;
}

export interface Company {
  id: string;
  projectId: string;
  companyName: string;
  taxId?: string;
  contactPerson?: string;
  createdAt?: string;
}

export interface Profile {
  id: string;
  companyId: string;
  fullName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export type ChannelType = 'line' | 'facebook' | 'whatsapp' | 'email' | 'webchat';
export type VerificationStatus = 'verified' | 'unverified' | 'pending_otp' | 'suspicious';

export interface Identity {
  id: string;
  profileId: string;
  channel: ChannelType;
  channelRefId: string; // e.g. Uad28c1eabbcbe1608e038d4d162f4944
  verificationStatus: VerificationStatus;
  boundAt: string;
}

export type TakeoverStatus = 'AI_ACTIVE' | 'PENDING_HUMAN' | 'ACTIVE_HUMAN' | 'RETURNED_TO_AI';

export interface Conversation {
  id: string;
  identityId: string;
  channel: ChannelType;
  takeoverStatus: TakeoverStatus;
  assignedOperator?: string;
  unreadCount?: number;
  lastMessageText?: string;
  lastMessageTimestamp?: string;
}

export type SenderRole = 'customer' | 'ai' | 'human' | 'system';

export interface Message {
  id: string;
  conversationId: string;
  senderRole: SenderRole;
  senderName?: string;
  content: string;
  attachments?: string[];
  createdAt: string;
}

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface Ticket {
  id: string;
  conversationId: string;
  subject: string;
  summary?: string;
  priority: PriorityLevel;
  status: TicketStatus;
  planeIssueId?: string;
  createdAt: string;
}

/**
 * Customer Timeline Event Taxonomy (Phase 0.5)
 */
export type TimelineEventType =
  | 'CONVERSATION_STARTED'
  | 'MESSAGE_RECEIVED'
  | 'IDENTITY_BOUND'
  | 'IDENTITY_VERIFIED'
  | 'OTP_SUCCESS'
  | 'OTP_FAILED'
  | 'HUMAN_TAKEOVER_REQUESTED'
  | 'HUMAN_TAKEOVER_CLAIMED'
  | 'RETURNED_TO_AI'
  | 'TICKET_CREATED'
  | 'TICKET_CLOSED'
  | 'PLANE_ESCALATION'
  | 'SLA_BREACHED'
  | 'SLA_RISK';

export interface CustomerTimelineEvent {
  id: string;
  profileId: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Authoritative Customer Web App Types
 * Strictly aligned with verified backend contracts
 */

export type CustomerAppRoute = 'home' | 'tickets' | 'ticket-detail' | 'help';

export interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  companyId?: string | number;
  role: 'customer' | 'guest';
}

export interface CustomerTicket {
  id: number | string;
  ticket_id?: string;
  ticket_number?: string;
  subject: string;
  summary: string;
  status: string;
  priority?: string;
  severity?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  last_activity?: string;
  conversation_id?: number | string;
}

/**
 * A quick-action chip the backend attached to a bot message. `value` is an enum
 * the server recognises — the client echoes it back verbatim and never invents
 * one.
 */
export interface CustomerChatAction {
  label: string;
  value: string;
  style?: 'primary' | 'default';
}

/**
 * `status` distinguishes a file the customer can actually open from one that
 * only exists in this tab. It is not cosmetic: an attachment that never reached
 * the server must not look identical to one that did, or the customer believes
 * they have sent evidence support cannot see.
 */
export interface CustomerMessageAttachment {
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  /** `local` is a preview of a file still being uploaded, valid in this tab only. */
  status?: 'ready' | 'uploading' | 'local' | 'failed';
  /** Why the upload failed, shown on the attachment card. */
  error?: string;
}

export type CustomerMessageDelivery = 'sending' | 'sent' | 'processing' | 'replied' | 'delivered' | 'failed';

export interface CustomerChatMessage {
  kind: 'chat';
  /** Render key. For an optimistic bubble this is the client `tempId`. */
  id: string;
  /** Stable backend identity when the payload carries one; preferred for dedupe. */
  externalId?: string;
  role: 'customer' | 'ai' | 'human' | 'operator';
  content: string;
  /**
   * The server's timestamp, or null when it sent none we could parse.
   *
   * Null rather than a substituted "now": a fabricated timestamp is
   * indistinguishable from a real one, sorts the message to the wrong place,
   * and hides a backend data problem instead of surfacing it.
   */
  createdAt: string | null;
  attachments?: CustomerMessageAttachment[];
  actions?: CustomerChatAction[];
  deliveryStatus?: CustomerMessageDelivery;
  /** Set on an optimistic bubble until the server accepts or rejects it. */
  pending?: boolean;
  /** Shown under a failed bubble. */
  error?: string;
}

/**
 * A state change the customer should see but that nobody said — a human joining
 * the conversation, a send being refused. Rendered as a centred notice, never as
 * an assistant bubble.
 */
export interface CustomerSystemNotice {
  kind: 'system';
  id: string;
  code: string;
  text: string;
  createdAt: string | null;
  tone: 'info' | 'warning' | 'error';
}

export type CustomerChatEntry = CustomerChatMessage | CustomerSystemNotice;

export interface CustomerSLAStatus {
  breached: boolean;
  targetMinutes?: number;
  remainingMinutes?: number;
  dueDate?: string;
}

export interface CustomerApiError {
  status: number;
  code?: string;
  message: string;
  isGuestError?: boolean;
  isSessionExpired?: boolean;
}

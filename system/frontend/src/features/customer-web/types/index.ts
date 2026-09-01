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

export interface CustomerChatMessage {
  id: string;
  role: 'customer' | 'ai' | 'human' | 'operator';
  content: string;
  createdAt: string;
  attachments?: Array<{
    fileUrl: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
  }>;
  isSending?: boolean;
}

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

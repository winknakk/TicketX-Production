import { API_BASE_URL } from '../../../lib/apiBaseUrl';
import { getCustomerToken, setCustomerToken, clearCustomerSession, getStoredGuestUuid, setStoredGuestUuid } from '../auth/customerSession';
import { normalizeCustomerError } from './customerErrors';
import type { CustomerProfile, CustomerTicket, CustomerSLAStatus, CustomerChatMessage } from '../types';

export class CustomerApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = getCustomerToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    // Strict boundary assertion: NEVER send tenant or operator headers
    delete headers['X-Org-Id'];
    delete headers['x-org-id'];
    delete headers['X-Project-Id'];
    delete headers['x-project-id'];

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw normalizeCustomerError(0, { message: 'Network connection failed' });
    }

    if (!res.ok) {
      let errorBody: any = {};
      try {
        errorBody = await res.json();
      } catch {}

      if (res.status === 401) {
        clearCustomerSession();
      }

      throw normalizeCustomerError(res.status, errorBody);
    }

    return res.json();
  }

  /**
   * Handshake with backend to establish customer or guest session token
   */
  async handshake(options?: { customerToken?: string; guestUuid?: string }): Promise<{
    token: string;
    sessionToken: string;
    guestUuid?: string;
    role: 'customer' | 'guest';
  }> {
    const existingGuestUuid = options?.guestUuid || getStoredGuestUuid() || undefined;

    const res = await this.request<{
      token: string;
      sessionToken: string;
      guestUuid?: string;
    }>('/api/v1/webchat/handshake', {
      method: 'POST',
      body: JSON.stringify({
        customerToken: options?.customerToken,
        guestUuid: existingGuestUuid,
      }),
    });

    const isGuest = !!res.guestUuid && !options?.customerToken;
    const role: 'customer' | 'guest' = isGuest ? 'guest' : 'customer';

    setCustomerToken(res.token, role);
    if (res.guestUuid) {
      setStoredGuestUuid(res.guestUuid);
    }

    return {
      ...res,
      role,
    };
  }

  /**
   * Fetch authenticated customer profile
   */
  async getProfile(): Promise<CustomerProfile> {
    const res = await this.request<{ success: boolean; profile: CustomerProfile }>('/api/portal/profile');
    return res.profile;
  }

  /**
   * Fetch customer-scoped tickets
   */
  async getTickets(): Promise<CustomerTicket[]> {
    const res = await this.request<{ success: boolean; tickets: CustomerTicket[] }>('/api/portal/tickets');
    return res.tickets || [];
  }

  /**
   * Fetch detail for a specific customer ticket
   */
  async getTicket(id: string | number): Promise<{
    ticket: CustomerTicket;
    slaStatus?: CustomerSLAStatus;
  }> {
    const res = await this.request<{
      success: boolean;
      ticket: CustomerTicket;
      slaStatus?: CustomerSLAStatus;
    }>(`/api/portal/tickets/${encodeURIComponent(String(id))}`);
    return {
      ticket: res.ticket,
      slaStatus: res.slaStatus,
    };
  }

  /**
   * Create a new ticket under customer's authoritative identity
   */
  async createTicket(payload: {
    subject: string;
    summary: string;
    priority?: string;
    severity?: string;
  }): Promise<{
    success: boolean;
    ticketNumber: string;
    dueDate?: string;
  }> {
    return this.request<{
      success: boolean;
      ticketNumber: string;
      dueDate?: string;
    }>('/api/portal/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Customer-safe transition (Confirm resolution or Reopen)
   */
  async transitionTicket(
    id: string | number,
    targetStatus: 'CUSTOMER_CONFIRMED' | 'REOPENED',
    reason?: string
  ): Promise<{
    success: boolean;
    ticketId: number | string;
    ticketNumber: string;
    to: string;
  }> {
    return this.request<{
      success: boolean;
      ticketId: number | string;
      ticketNumber: string;
      to: string;
    }>(`/api/portal/tickets/${encodeURIComponent(String(id))}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, reason }),
    });
  }

  /**
   * Fetch active support conversation messages
   */
  async getMessages(): Promise<{
    conversationId: string | null;
    messages: CustomerChatMessage[];
  }> {
    const res = await this.request<{
      conversationId: string | null;
      messages: CustomerChatMessage[];
    }>('/api/v1/webchat/messages');
    return {
      conversationId: res.conversationId,
      messages: res.messages || [],
    };
  }

  /**
   * Obtain single-use ephemeral ticket for WebSocket connection
   */
  async getWsTicket(): Promise<string> {
    const res = await this.request<{
      success: boolean;
      ticket: string;
      expiresIn: number;
    }>('/api/v1/webchat/ws-ticket', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.ticket;
  }
}

export const customerApi = new CustomerApiClient();

import { API_BASE_URL } from '../../../lib/apiBaseUrl';
import {
  getCustomerToken,
  setCustomerToken,
  clearCustomerSession,
  getStoredGuestUuid,
  setStoredGuestUuid,
  getCustomerRole,
  notifySessionExpired,
} from '../auth/customerSession';
import { normalizeCustomerError } from './customerErrors';
import type { CustomerProfile, CustomerTicket, CustomerSLAStatus } from '../types';

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
        // A 401 on an authenticated session is an expiry, not a demotion. It
        // used to clear storage and return, which left React holding a
        // "customer" role against a dead token — the screen stayed on the
        // customer shell while every call failed, and the customer was never
        // told. The session layer decides what to do; it just has to hear it.
        const wasCustomer = getCustomerRole() === 'customer';
        clearCustomerSession();
        if (wasCustomer && endpoint !== '/api/v1/webchat/handshake') {
          notifySessionExpired();
        }
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
  /**
   * Fetch authenticated customer profile
   */
  async getProfile(): Promise<CustomerProfile> {
    const res = await this.request<{ success: boolean; profile: CustomerProfile }>('/api/portal/profile');
    return res.profile;
  }

  /**
   * Update authenticated customer profile
   */
  async updateProfile(payload: { name?: string; phone?: string }): Promise<CustomerProfile> {
    const res = await this.request<{ success: boolean; profile: CustomerProfile }>('/api/portal/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.profile;
  }

  /**
   * Fetch accessible projects for customer
   */
  async getProjects(): Promise<{
    success: boolean;
    currentProjectId: number;
    projects: Array<{
      id: number;
      name: string;
      companyId: number;
      companyName: string;
      orgId: string;
      isActive: boolean;
    }>;
  }> {
    return this.request('/api/portal/projects');
  }

  /**
   * Switch active project
   */
  async switchProject(projectId: number): Promise<{
    success: boolean;
    projectId: number;
    projectName: string;
    companyId: number;
    companyName: string;
    token: string;
  }> {
    const res = await this.request<any>('/api/portal/switch-project', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
    if (res.token) {
      // sessionStorage only. The localStorage mirror this used to keep was a
      // second copy of a live credential with a longer lifetime than the tab,
      // and nothing reads it any more.
      setCustomerToken(res.token, 'customer');
    }
    return res;
  }

  /**
   * Fetch customer-scoped tickets
   */
  async getTickets(projectId?: number | string): Promise<CustomerTicket[]> {
    const query = projectId ? `?projectId=${encodeURIComponent(String(projectId))}` : '';
    const res = await this.request<{ success: boolean; tickets: CustomerTicket[] }>(`/api/portal/tickets${query}`);
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
    /**
     * Raw rows. They are deliberately not typed as `CustomerChatMessage`: the
     * backend sends whatever is in `messages`, including rows whose content is
     * a routing sentinel, and classification belongs to `normalizeHistoryEntries`
     * rather than to a cast here.
     */
    messages: unknown[];
  }> {
    const res = await this.request<{
      conversationId: string | null;
      messages: unknown[];
    }>('/api/v1/webchat/messages');
    return {
      conversationId: res.conversationId,
      messages: Array.isArray(res.messages) ? res.messages : [],
    };
  }

  /**
   * Upload one customer attachment and return a URL the conversation can keep.
   *
   * `POST /api/v1/webchat/upload/presign` is the endpoint the embeddable widget
   * already targets. It **does not exist on the backend** — a live probe returns
   * `404 Route POST:/api/v1/webchat/upload/presign not found` — so today this
   * always throws, and the composer surfaces that as a visible attachment
   * failure. That is the intended behaviour until the backend implements it:
   * the alternative, showing a `blob:` URL as though the file had been sent,
   * tells the customer they have submitted evidence support cannot see.
   *
   * The call is written against the contract the widget assumes, so when the
   * route lands the portal starts working with no further change here.
   */
  async uploadAttachment(file: File): Promise<{ fileUrl: string; fileName: string; fileType?: string; fileSize?: number }> {
    const presign = await this.request<{ uploadUrl: string; fileUrl: string }>('/api/v1/webchat/upload/presign', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
    });

    if (!presign?.uploadUrl || !presign?.fileUrl) {
      throw normalizeCustomerError(502, { message: 'Upload endpoint returned no URL' });
    }

    let putRes: Response;
    try {
      putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
    } catch {
      throw normalizeCustomerError(0, { message: 'Upload connection failed' });
    }
    if (!putRes.ok) {
      throw normalizeCustomerError(putRes.status, { message: 'Upload rejected by storage' });
    }

    return { fileUrl: presign.fileUrl, fileName: file.name, fileType: file.type, fileSize: file.size };
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

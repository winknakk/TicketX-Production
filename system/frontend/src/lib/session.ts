/**
 * Admin console session.
 *
 * Replaces the previous VITE_API_KEY model. A build-time VITE_* variable is
 * inlined into the public JS bundle, so shipping a privileged API key that way
 * hands it to anyone who loads the dashboard. The console now authenticates
 * with a short-lived session token issued by POST /api/v1/auth/login.
 */

const TOKEN_KEY = 'session_token';
const EXPIRY_KEY = 'session_expires_at';

export interface SessionUser {
  username?: string;
  email?: string;
  name?: string;
  role?: string;
  orgId?: string | null;
  projectIds?: number[] | null;
}

export function getSessionToken(): string {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  if (!token) return '';

  const expiresAt = localStorage.getItem(EXPIRY_KEY);
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    clearSession();
    return '';
  }
  return token;
}

export function setSession(token: string, expiresAt?: string, user?: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) localStorage.setItem(EXPIRY_KEY, expiresAt);
  if (user) {
    if (user.role) localStorage.setItem('user_role', user.role);
    if (user.orgId) localStorage.setItem('active_org_id', user.orgId);
    if (user.email) localStorage.setItem('active_operator_email', user.email);
    localStorage.setItem(
      'active_operator_profile',
      user.name || user.email?.split('@')[0] || 'Operator'
    );
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem('user_role');
  localStorage.removeItem('active_org_id');
  localStorage.removeItem('active_operator_email');
  localStorage.removeItem('active_operator_profile');
}

export function isAuthenticated(): boolean {
  return getSessionToken().length > 0;
}

/** Sends the operator to the login screen after the session is gone. */
export function redirectToLogin(): void {
  clearSession();
  if (!window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login';
    window.location.reload();
  }
}

/**
 * Shared fetch utility that attaches the operator's session token to API
 * requests and reacts to an expired or rejected session.
 *
 * Usage:
 *   import { apiFetch } from '../lib/apiFetch';
 *   const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations`);
 */
import { getSessionToken, redirectToLogin } from './session';

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const existing = (init?.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = { ...existing };

  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...init, headers });

  // A 401 means the session is gone or was never valid. Sending the operator
  // back to the login screen is the only useful action, and it stops the app
  // from rendering empty views that look like missing data.
  if (response.status === 401) {
    redirectToLogin();
  }

  return response;
}

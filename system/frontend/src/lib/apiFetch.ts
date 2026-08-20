/**
 * Shared fetch utility that automatically attaches the Bearer token
 * from VITE_API_KEY environment variable to all API requests.
 *
 * Usage:
 *   import { apiFetch } from '../lib/apiFetch';
 *   const res = await apiFetch(`${apiBaseUrl}/api/admin/conversations`);
 */

const API_KEY = import.meta.env.VITE_API_KEY || '';

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const existing = (init?.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = { ...existing };
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }
  return fetch(url, { ...init, headers });
}

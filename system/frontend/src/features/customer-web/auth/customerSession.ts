/**
 * Customer Session Storage
 *
 * Security Architecture Decision:
 * 1. Customer JWT tokens are stored in `sessionStorage` (keyed as `ticketx_customer_token`)
 *    rather than `localStorage`, preventing persistent exposure on shared computers and
 *    preventing collision with operator/admin credentials.
 * 2. Anonymous `guestUuid` is retained in `localStorage` (`ticketx_guest_uuid`) so that a
 *    visitor's active AI chat history survives browser refreshes without granting ticket access.
 * 3. Never logs token strings or credential prefixes to console or analytics.
 */

const CUSTOMER_TOKEN_KEY = 'ticketx_customer_token';
const GUEST_UUID_KEY = 'ticketx_guest_uuid';
const CUSTOMER_ROLE_KEY = 'ticketx_customer_role';

let inMemoryCustomerToken: string | null = null;

export function getCustomerToken(): string | null {
  if (inMemoryCustomerToken) return inMemoryCustomerToken;
  try {
    const token = sessionStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (token) {
      inMemoryCustomerToken = token;
      return token;
    }
  } catch {
    // sessionStorage unavailable (e.g. strict sandbox)
  }
  return null;
}

export function setCustomerToken(token: string, role: 'customer' | 'guest' = 'customer'): void {
  inMemoryCustomerToken = token;
  try {
    sessionStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    sessionStorage.setItem(CUSTOMER_ROLE_KEY, role);
  } catch {}
}

export function clearCustomerSession(): void {
  inMemoryCustomerToken = null;
  try {
    sessionStorage.removeItem(CUSTOMER_TOKEN_KEY);
    sessionStorage.removeItem(CUSTOMER_ROLE_KEY);
  } catch {}
}

export function getStoredGuestUuid(): string | null {
  try {
    return localStorage.getItem(GUEST_UUID_KEY);
  } catch {
    return null;
  }
}

export function setStoredGuestUuid(guestUuid: string): void {
  try {
    localStorage.setItem(GUEST_UUID_KEY, guestUuid);
  } catch {}
}

export function getCustomerRole(): 'customer' | 'guest' {
  try {
    const role = sessionStorage.getItem(CUSTOMER_ROLE_KEY);
    return role === 'customer' ? 'customer' : 'guest';
  } catch {
    return 'guest';
  }
}

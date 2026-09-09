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
/** Written by the login screen; the credential a handshake exchanges for a token. */
const CUSTOMER_PROOF_KEY = 'ticketx_customer_proof';

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

/**
 * Discards the long-lived login proof issued by /api/v1/auth/login.
 *
 * Kept separate from clearCustomerSession because the two have different
 * lifetimes: the webchat token is short-lived and re-obtained by a handshake,
 * while the proof is the login credential. Clearing the session alone left a
 * rejected proof in localStorage to be replayed on every retry — the handshake
 * 401'd, the session was cleared, the same dead proof was sent again, forever.
 */
export function clearCustomerProof(): void {
  try {
    localStorage.removeItem(CUSTOMER_PROOF_KEY);
  } catch {}
}

export function getCustomerProof(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_PROOF_KEY);
  } catch {
    return null;
  }
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

/**
 * The claims the server signed into the session token.
 *
 * Reading them is not a security decision — the backend re-verifies the
 * signature on every request. It is how the client learns what the server
 * decided this session is, instead of inferring it. `role` in particular used
 * to be guessed from the absence of `guestUuid` in the handshake response,
 * which is not something the server ever said.
 *
 * Returns null for a missing or unparseable token.
 */
export interface CustomerTokenClaims {
  role?: string;
  profileId?: string;
  identityId?: string;
  channelRef?: string;
  customerId?: string;
  projectId?: string;
  companyId?: string;
  exp?: number;
}

export function readTokenClaims(token: string | null): CustomerTokenClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // JWT base64url is unpadded, and `atob` rejects a string whose length is
    // 2 or 3 more than a multiple of 4. Without restoring the padding, whether
    // a token could be read depended on how long its payload happened to be —
    // which made the expired-session path fail silently for some tokens and
    // work for others.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as CustomerTokenClaims;
  } catch {
    return null;
  }
}

/** True when the token is present, unexpired, and the server marked it customer. */
export function hasLiveCustomerToken(): boolean {
  const claims = readTokenClaims(getCustomerToken());
  if (!claims || claims.role !== 'customer') return false;
  if (typeof claims.exp !== 'number') return false;
  // A small skew guard: a token about to expire is treated as already gone so
  // the session re-authenticates deliberately rather than mid-request.
  return claims.exp * 1000 > Date.now() + 5_000;
}

/**
 * Announces that an authenticated call was refused.
 *
 * The session layer listens for this. Before it existed, `customerApi` cleared
 * storage on a 401 and told nobody: React state still said "customer", the
 * socket kept its dead token, and the customer was left on a screen that
 * silently could not load anything.
 */
export const SESSION_EXPIRED_EVENT = 'ticketx:session_expired';

export function notifySessionExpired(): void {
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  } catch {
    // Non-browser context (tests); the caller still handles the rejection.
  }
}

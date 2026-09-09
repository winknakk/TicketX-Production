import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { CustomerProfile, CustomerApiError } from '../types';
import { customerApi } from '../api/customerApi';
import {
  getCustomerToken,
  getCustomerRole,
  clearCustomerSession,
  clearCustomerProof,
  getCustomerProof,
  readTokenClaims,
  hasLiveCustomerToken,
  SESSION_EXPIRED_EVENT,
} from './customerSession';

/**
 * The states a customer session can actually be in.
 *
 * The point of naming them is that `CUSTOMER -> GUEST` is not one of the
 * transitions. An expired credential used to land the customer back on the
 * guest shell with no explanation, which is indistinguishable from "you were
 * never signed in" — so the customer had no idea they needed to re-authenticate
 * and support had no idea why their portal looked empty. Expiry now has its own
 * state, and only an explicit logout, or an initialization that was never
 * authenticated in the first place, may enter GUEST.
 */
export type CustomerSessionStatus =
  | 'GUEST'
  | 'AUTHENTICATING'
  | 'CUSTOMER'
  | 'CUSTOMER_PROJECT_SELECTED'
  | 'SESSION_EXPIRED'
  | 'AUTH_ERROR';

export interface CustomerProjectSummary {
  id: number;
  name: string;
  companyId: number;
  companyName: string;
  orgId: string;
  isActive: boolean;
}

interface CustomerSessionContextType {
  status: CustomerSessionStatus;
  token: string | null;
  role: 'customer' | 'guest';
  isGuest: boolean;
  profile: CustomerProfile | null;
  activeProjectId: number | null;
  availableProjects: CustomerProjectSummary[];
  isLoading: boolean;
  error: CustomerApiError | null;
  isSessionExpired: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  switchProject: (projectId: number) => Promise<void>;
  updateProfileData: (data: { name?: string; phone?: string }) => Promise<void>;
  reconnect: (customToken?: string) => Promise<void>;
  dismissSessionExpired: () => void;
  logout: () => void;
}

const CustomerSessionContext = createContext<CustomerSessionContextType | null>(null);

const GUEST_PROFILE: CustomerProfile = {
  id: 'guest',
  name: 'ผู้มาเยือน (Guest)',
  email: undefined,
  companyName: 'TicketX Support Hub',
  role: 'guest',
};

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CustomerSessionStatus>(() =>
    getCustomerRole() === 'customer' ? 'AUTHENTICATING' : 'GUEST'
  );
  const [token, setTokenState] = useState<string | null>(getCustomerToken);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [availableProjects, setAvailableProjects] = useState<CustomerProjectSummary[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<CustomerApiError | null>(null);

  /**
   * Guards every async result against a newer cycle having started.
   *
   * The race this exists for: a guest handshake fired on mount and a customer
   * authentication fired a moment later. If the guest response landed second it
   * overwrote the authenticated session, and the customer was silently demoted
   * by a request that had already been superseded. Results now carry the
   * generation they were started in and are dropped if they are stale.
   */
  const generationRef = useRef(0);

  const loadProjects = useCallback(async (generation: number) => {
    try {
      const res = await customerApi.getProjects();
      if (generation !== generationRef.current) return;
      setAvailableProjects(res.projects || []);
      // The active project is the backend's answer, never a local guess.
      const current = res.currentProjectId ?? res.projects?.find((p) => p.isActive)?.id ?? null;
      if (current) {
        setActiveProjectId(Number(current));
        setStatus('CUSTOMER_PROJECT_SELECTED');
      }
    } catch {
      // Non-blocking: a customer with no readable project list is still a
      // customer. A 401 here is reported through the session-expired channel.
    }
  }, []);

  const applyCustomer = useCallback(
    async (generation: number, sessionToken: string) => {
      if (generation !== generationRef.current) return;
      setTokenState(sessionToken);
      setStatus('CUSTOMER');

      try {
        const prof = await customerApi.getProfile();
        if (generation !== generationRef.current) return;
        setProfile({ ...prof, role: 'customer' });
      } catch (err: any) {
        if (generation !== generationRef.current) return;
        if (err?.status === 401) {
          // Handled by the session-expired listener; do not fabricate an identity.
          return;
        }
        // Identity is never invented. A thin profile stays thin rather than
        // borrowing a name from anywhere else in the browser.
        const claims = readTokenClaims(sessionToken);
        setProfile({
          id: String(claims?.profileId || 'customer'),
          name: 'คุณลูกค้า',
          companyName: 'TicketX Support Hub',
          role: 'customer',
        });
      }

      await loadProjects(generation);
    },
    [loadProjects]
  );

  const initSession = useCallback(
    async (customToken?: string) => {
      const generation = ++generationRef.current;
      setIsLoading(true);
      setError(null);

      try {
        // 1. An existing, unexpired customer token is the session. Replaying a
        //    login proof through a handshake is only for establishing one.
        //
        //    This ordering is what makes a refresh survive without keeping a
        //    live JWT in localStorage: the token already sits in sessionStorage,
        //    which outlives a reload. Handshaking first would have answered
        //    "guest" whenever no proof was stored and overwritten it.
        if (!customToken && hasLiveCustomerToken()) {
          const existing = getCustomerToken();
          if (existing) {
            setStatus('AUTHENTICATING');
            await applyCustomer(generation, existing);
            return;
          }
        }

        // 1b. A customer token that has simply run out is an expired session,
        //     not a new visitor. Handshaking on past it would return a guest
        //     and hand the customer the anonymous shell with no explanation —
        //     the silent downgrade this state machine exists to prevent.
        if (!customToken) {
          const staleClaims = readTokenClaims(getCustomerToken());
          if (staleClaims?.role === 'customer') {
            // Deliberately does NOT clear storage. Clearing it here made the
            // decision non-idempotent: React StrictMode invokes this effect
            // twice, and the second pass found the evidence already erased,
            // fell through to a handshake, and produced exactly the silent
            // guest downgrade this branch exists to prevent. The token is dead
            // either way — the server refuses it — so leaving it in place keeps
            // every later pass reaching the same conclusion. Logout and
            // re-authentication both replace it.
            setTokenState(null);
            setStatus('SESSION_EXPIRED');
            return;
          }
        }

        // 2. Otherwise establish a session: with the supplied proof, the stored
        //    login proof, or anonymously.
        const proof = customToken || getCustomerProof() || undefined;
        if (proof) setStatus('AUTHENTICATING');

        let hs;
        try {
          hs = await customerApi.handshake({ customerToken: proof });
        } catch (handshakeErr: any) {
          if (proof && handshakeErr?.status === 401) {
            // A proof the server refuses is dead. Discard it and start a plain
            // anonymous session rather than replaying it forever.
            clearCustomerProof();
            hs = await customerApi.handshake({});
          } else {
            throw handshakeErr;
          }
        }
        if (generation !== generationRef.current) return;

        // The server signs what this session is; prefer that over inferring a
        // role from which fields came back.
        const claims = readTokenClaims(hs.token);
        const serverRole = claims?.role === 'customer' ? 'customer' : hs.role;

        if (serverRole === 'customer') {
          await applyCustomer(generation, hs.token);
        } else {
          setTokenState(hs.token);
          clearCustomerProof();
          setProfile(GUEST_PROFILE);
          setAvailableProjects([]);
          setActiveProjectId(null);
          setStatus('GUEST');
        }
      } catch (err: any) {
        if (generation !== generationRef.current) return;
        setError(err);
        setStatus(err?.isSessionExpired ? 'SESSION_EXPIRED' : 'AUTH_ERROR');
      } finally {
        if (generation === generationRef.current) setIsLoading(false);
      }
    },
    [applyCustomer]
  );

  useEffect(() => {
    initSession();
  }, [initSession]);

  // An authenticated call was refused: the session is over, and the customer is
  // told so instead of being quietly handed the guest shell.
  useEffect(() => {
    const onExpired = () => {
      generationRef.current += 1; // abandon anything still in flight
      setStatus('SESSION_EXPIRED');
      setTokenState(null);
      setAvailableProjects([]);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    const handleProjectSwitched = (e: any) => {
      const detail = e.detail;

      // Linking a project by code is an authentication event: the server hands
      // back a customer token for the identity that redeemed the code.
      if (detail?.token) {
        const generation = ++generationRef.current;
        setStatus('AUTHENTICATING');
        setIsSessionExpired(false);
        void applyCustomer(generation, detail.token);
      } else if (detail?.companyName) {
        setProfile((prev) =>
          prev ? { ...prev, companyName: detail.companyName, companyId: String(detail.companyId || prev.companyId) } : prev
        );
      }
      if (detail?.projectId) {
        setActiveProjectId(Number(detail.projectId));
      }
    };
    window.addEventListener('ticketx:project_switched', handleProjectSwitched);
    return () => window.removeEventListener('ticketx:project_switched', handleProjectSwitched);
  }, [applyCustomer]);

  const switchProject = useCallback(
    async (projectId: number) => {
      const res = await customerApi.switchProject(projectId);
      if (res.success) {
        const generation = ++generationRef.current;
        setActiveProjectId(res.projectId);
        setProfile((prev) =>
          prev ? { ...prev, companyName: res.companyName || prev.companyName, companyId: String(res.companyId || prev.companyId) } : prev
        );
        await loadProjects(generation);
        window.dispatchEvent(new CustomEvent('ticketx:project_switched', { detail: res }));
      }
    },
    [loadProjects]
  );

  const updateProfileData = useCallback(async (data: { name?: string; phone?: string }) => {
    const updated = await customerApi.updateProfile(data);
    setProfile({ ...updated, role: 'customer' });
  }, []);

  const reconnect = useCallback(
    async (customToken?: string) => {
      await initSession(customToken);
    },
    [initSession]
  );

  // Kept for the dialog's dismiss button. Dismissing the notice does not
  // resurrect the session — it only stops shouting about it.
  const setIsSessionExpired = (v: boolean) => {
    if (!v) setStatus((s) => (s === 'SESSION_EXPIRED' ? 'GUEST' : s));
  };
  const dismissSessionExpired = useCallback(() => {
    setStatus((s) => (s === 'SESSION_EXPIRED' ? 'GUEST' : s));
  }, []);

  const logout = useCallback(() => {
    generationRef.current += 1;
    clearCustomerSession();
    try {
      localStorage.removeItem('ticketx_customer_proof');
      localStorage.removeItem('ticketx_guest_uuid');
      localStorage.removeItem('user_role');
      localStorage.removeItem('active_operator_profile');
      localStorage.removeItem('active_operator_email');
      localStorage.removeItem('session_token');
    } catch {}
    setTokenState(null);
    setProfile(null);
    setAvailableProjects([]);
    setActiveProjectId(null);
    setStatus('GUEST');
    window.location.hash = '#/';
    window.location.reload();
  }, []);

  const role: 'customer' | 'guest' =
    status === 'CUSTOMER' || status === 'CUSTOMER_PROJECT_SELECTED' ? 'customer' : 'guest';

  const value: CustomerSessionContextType = {
    status,
    token,
    role,
    // SESSION_EXPIRED is not a guest: the shell must not offer the guest
    // experience to someone whose session merely lapsed.
    isGuest: status === 'GUEST',
    profile,
    activeProjectId,
    availableProjects,
    isLoading,
    error,
    isSessionExpired: status === 'SESSION_EXPIRED',
    isSettingsOpen,
    setIsSettingsOpen,
    switchProject,
    updateProfileData,
    reconnect,
    dismissSessionExpired,
    logout,
  };

  return <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession(): CustomerSessionContextType {
  const context = useContext(CustomerSessionContext);
  if (!context) {
    throw new Error('useCustomerSession must be used within a CustomerSessionProvider');
  }
  return context;
}

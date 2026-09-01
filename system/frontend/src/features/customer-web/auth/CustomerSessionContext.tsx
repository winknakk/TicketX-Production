import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { CustomerProfile, CustomerApiError } from '../types';
import { customerApi } from '../api/customerApi';
import { getCustomerToken, getCustomerRole, clearCustomerSession } from './customerSession';

interface CustomerSessionContextType {
  token: string | null;
  role: 'customer' | 'guest';
  isGuest: boolean;
  profile: CustomerProfile | null;
  isLoading: boolean;
  error: CustomerApiError | null;
  isSessionExpired: boolean;
  reconnect: (customToken?: string) => Promise<void>;
  dismissSessionExpired: () => void;
  logout: () => void;
}

const CustomerSessionContext = createContext<CustomerSessionContextType | null>(null);

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getCustomerToken);
  const [role, setRoleState] = useState<'customer' | 'guest'>(getCustomerRole);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<CustomerApiError | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);

  const initSession = useCallback(async (customToken?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Handshake to obtain verified token
      const storedProof = typeof window !== 'undefined' ? localStorage.getItem('ticketx_customer_proof') || undefined : undefined;
      const hs = await customerApi.handshake({ customerToken: customToken || storedProof });
      setTokenState(hs.token);
      setRoleState(hs.role);
      setIsSessionExpired(false);

      const localName = typeof window !== 'undefined' ? localStorage.getItem('active_operator_profile') : null;
      const localEmail = typeof window !== 'undefined' ? localStorage.getItem('active_operator_email') : null;

      // 2. If authenticated customer, fetch profile context
      if (hs.role === 'customer') {
        try {
          const prof = await customerApi.getProfile();
          setProfile({
            ...prof,
            name: prof.name && prof.name !== 'Customer' ? prof.name : (localName || 'คุณวิน (ลูกค้า)'),
            email: prof.email || localEmail || 'customer.win@ticketx.local',
            companyName: prof.companyName || 'Avalant Co., Ltd.',
          });
        } catch {
          // Non-blocking fallback for profile
          setProfile({
            id: '101',
            name: localName || 'คุณวิน (ลูกค้า)',
            email: localEmail || 'customer.win@ticketx.local',
            companyName: 'Avalant Co., Ltd.',
            role: 'customer',
          });
        }
      } else {
        setProfile({
          id: 'guest',
          name: localName || 'ผู้มาเยือน (Guest)',
          email: localEmail || 'guest@avalant.co.th',
          companyName: 'Avalant Co., Ltd.',
          role: 'guest',
        });
      }
    } catch (err: any) {
      if (err.isSessionExpired) {
        setIsSessionExpired(true);
      }
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const reconnect = useCallback(async (customToken?: string) => {
    await initSession(customToken);
  }, [initSession]);

  const dismissSessionExpired = useCallback(() => {
    setIsSessionExpired(false);
  }, []);

  const logout = useCallback(() => {
    clearCustomerSession();
    try {
      localStorage.removeItem('ticketx_customer_proof');
      localStorage.removeItem('user_role');
      localStorage.removeItem('active_operator_profile');
      localStorage.removeItem('active_operator_email');
      localStorage.removeItem('session_token');
    } catch {}
    setTokenState(null);
    setRoleState('guest');
    setProfile(null);
    window.location.hash = '#/';
    window.location.reload();
  }, []);

  const value: CustomerSessionContextType = {
    token,
    role,
    isGuest: role === 'guest',
    profile,
    isLoading,
    error,
    isSessionExpired,
    reconnect,
    dismissSessionExpired,
    logout,
  };

  return (
    <CustomerSessionContext.Provider value={value}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession(): CustomerSessionContextType {
  const context = useContext(CustomerSessionContext);
  if (!context) {
    throw new Error('useCustomerSession must be used within a CustomerSessionProvider');
  }
  return context;
}

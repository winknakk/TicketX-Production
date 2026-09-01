import { useState, useEffect, useCallback } from 'react';
import type { CustomerTicket, CustomerSLAStatus, CustomerApiError } from '../types';
import { customerApi } from '../api/customerApi';
import { useCustomerSession } from '../auth/CustomerSessionContext';

export function useCustomerTickets() {
  const { isGuest, token } = useCustomerSession();
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<CustomerApiError | null>(null);

  const fetchTickets = useCallback(async () => {
    if (isGuest) {
      setIsLoading(false);
      setError({
        status: 403,
        code: 'GUEST_NOT_PERMITTED',
        message: 'กรุณายืนยันตัวตนเพื่อดูประวัติการแจ้งปัญหา',
        isGuestError: true,
      });
      return;
    }

    if (!token) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await customerApi.getTickets();
      setTickets(data);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [isGuest, token]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (payload: {
    subject: string;
    summary: string;
    priority?: string;
    severity?: string;
  }) => {
    const res = await customerApi.createTicket(payload);
    await fetchTickets();
    return res;
  };

  return {
    tickets,
    isLoading,
    error,
    refreshTickets: fetchTickets,
    createTicket,
  };
}

export function useCustomerTicketDetail(ticketId: string | number | null) {
  const { isGuest, token } = useCustomerSession();
  const [ticket, setTicket] = useState<CustomerTicket | null>(null);
  const [slaStatus, setSlaStatus] = useState<CustomerSLAStatus | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<CustomerApiError | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const fetchDetail = useCallback(async () => {
    if (!ticketId || isGuest || !token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await customerApi.getTicket(ticketId);
      setTicket(res.ticket);
      setSlaStatus(res.slaStatus);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, isGuest, token]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const transitionStatus = async (
    targetStatus: 'CUSTOMER_CONFIRMED' | 'REOPENED',
    reason?: string
  ) => {
    if (!ticketId) return;
    setIsTransitioning(true);
    try {
      const res = await customerApi.transitionTicket(ticketId, targetStatus, reason);
      // Optimistically update local ticket state
      setTicket((prev) => (prev ? { ...prev, status: res.to } : null));
      return res;
    } finally {
      setIsTransitioning(false);
    }
  };

  return {
    ticket,
    slaStatus,
    isLoading,
    error,
    isTransitioning,
    refreshDetail: fetchDetail,
    transitionStatus,
  };
}

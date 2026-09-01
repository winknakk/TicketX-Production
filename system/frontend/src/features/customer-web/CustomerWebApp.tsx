import React, { useState, useEffect, useCallback } from 'react';
import type { CustomerAppRoute, CustomerTicket } from './types';
import { CustomerSessionProvider, useCustomerSession } from './auth/CustomerSessionContext';
import { CustomerHeader } from './components/layout/CustomerHeader';
import { CustomerSidebar, CustomerBottomNav } from './components/layout/CustomerNavigation';
import { CustomerHomePage } from './pages/CustomerHomePage';
import { CustomerTicketsPage } from './pages/CustomerTicketsPage';
import { CustomerTicketDetailPage } from './pages/CustomerTicketDetailPage';
import { CustomerHelpPage } from './pages/CustomerHelpPage';
import { SessionExpiredDialog } from './components/common/CustomerAuthAlerts';
import { useCustomerTickets } from './hooks/useCustomerTickets';

function CustomerAppInner() {
  const { isSessionExpired, reconnect, dismissSessionExpired } = useCustomerSession();
  const { tickets } = useCustomerTickets();

  const parseRouteFromHash = (hashStr: string): { route: CustomerAppRoute; ticketId: string | null } => {
    const clean = hashStr.replace(/^#\/?/, '').split('?')[0];
    const parts = clean.split('/');

    if (parts[0] === 'portal') {
      if (parts[1] === 'tickets' && parts[2]) {
        return { route: 'ticket-detail', ticketId: parts[2] };
      }
      if (parts[1] === 'tickets') return { route: 'tickets', ticketId: null };
      if (parts[1] === 'help') return { route: 'help', ticketId: null };
      return { route: 'home', ticketId: null };
    }

    if (parts[0] === 'tickets' && parts[1]) {
      return { route: 'ticket-detail', ticketId: parts[1] };
    }
    if (parts[0] === 'tickets') return { route: 'tickets', ticketId: null };
    if (parts[0] === 'help') return { route: 'help', ticketId: null };
    return { route: 'home', ticketId: null };
  };

  // Internal route state with URL hash sync
  const [activeRoute, setActiveRoute] = useState<CustomerAppRoute>(() => {
    return parseRouteFromHash(window.location.hash).route;
  });

  const [selectedTicketId, setSelectedTicketId] = useState<string | number | null>(() => {
    return parseRouteFromHash(window.location.hash).ticketId;
  });

  // Sync hash when navigating
  const handleNavigate = useCallback((route: CustomerAppRoute) => {
    setActiveRoute(route);
    if (route === 'home') {
      window.location.hash = '#/portal';
      setSelectedTicketId(null);
    } else if (route === 'tickets') {
      window.location.hash = '#/portal/tickets';
      setSelectedTicketId(null);
    } else if (route === 'help') {
      window.location.hash = '#/portal/help';
      setSelectedTicketId(null);
    }
  }, []);

  const handleSelectTicket = useCallback((ticket: CustomerTicket) => {
    const ticketId = ticket.ticket_number || ticket.ticket_id || ticket.id;
    setSelectedTicketId(ticketId);
    setActiveRoute('ticket-detail');
    window.location.hash = `#/portal/tickets/${encodeURIComponent(String(ticketId))}`;
  }, []);

  // Listen to external hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseRouteFromHash(window.location.hash);
      setActiveRoute(parsed.route);
      setSelectedTicketId(parsed.ticketId);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const activeTicketCount = tickets.filter(
    (t) => !['CLOSED', 'CUSTOMER_CONFIRMED', 'CANCELLED'].includes(t.status?.toUpperCase() || '')
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased pb-16 lg:pb-0">
      <CustomerHeader activeRoute={activeRoute} onNavigate={handleNavigate} />

      <div className="flex flex-1 min-h-0">
        <CustomerSidebar
          activeRoute={activeRoute}
          onNavigate={handleNavigate}
          ticketCount={activeTicketCount}
        />

        <main className="flex flex-1 flex-col min-w-0 overflow-y-auto" tabIndex={-1}>
          {activeRoute === 'home' && (
            <CustomerHomePage
              onNavigate={handleNavigate}
              onSelectTicket={handleSelectTicket}
            />
          )}

          {activeRoute === 'tickets' && (
            <CustomerTicketsPage
              onNavigate={handleNavigate}
              onSelectTicket={handleSelectTicket}
            />
          )}

          {activeRoute === 'ticket-detail' && selectedTicketId && (
            <CustomerTicketDetailPage
              ticketId={selectedTicketId}
              onBack={() => handleNavigate('tickets')}
              onNavigate={handleNavigate}
            />
          )}

          {activeRoute === 'help' && (
            <CustomerHelpPage onNavigate={handleNavigate} />
          )}
        </main>
      </div>

      <CustomerBottomNav
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        ticketCount={activeTicketCount}
      />

      <SessionExpiredDialog
        isOpen={isSessionExpired}
        onReconnect={async () => {
          dismissSessionExpired();
          await reconnect();
        }}
      />
    </div>
  );
}

export function CustomerWebApp() {
  return (
    <CustomerSessionProvider>
      <CustomerAppInner />
    </CustomerSessionProvider>
  );
}

export default CustomerWebApp;

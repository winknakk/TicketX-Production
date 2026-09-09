import { createContext, useContext, type ReactNode } from 'react';
import { useCustomerSocket, type CustomerChatController } from '../hooks/useCustomerSocket';

/**
 * One socket, one transcript, for the whole portal.
 *
 * The hook used to be called from `CustomerHomePage`, so the connection existed
 * only while the customer was looking at the chat. Two consequences followed:
 * navigating to their tickets and back re-ran the whole handshake, and
 * `project_switched` — which the server delivers over this socket after a join
 * code is accepted — was dropped entirely if it arrived while they were on any
 * other route, leaving the session stuck as a guest with no error anywhere.
 *
 * Mounting the provider above the router fixes both, and satisfies the rule
 * that exactly one place may append to the conversation.
 */
const CustomerChatContext = createContext<CustomerChatController | null>(null);

export function CustomerChatProvider({ children }: { children: ReactNode }) {
  const controller = useCustomerSocket();
  return <CustomerChatContext.Provider value={controller}>{children}</CustomerChatContext.Provider>;
}

export function useCustomerChat(): CustomerChatController {
  const ctx = useContext(CustomerChatContext);
  if (!ctx) {
    throw new Error('useCustomerChat must be used inside CustomerChatProvider');
  }
  return ctx;
}

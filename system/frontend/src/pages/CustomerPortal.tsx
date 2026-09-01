/**
 * Legacy CustomerPortal wrapper redirecting directly to standalone CustomerWebApp
 */
import React from 'react';
import { CustomerWebApp } from '../features/customer-web/CustomerWebApp';

export function CustomerPortal() {
  return <CustomerWebApp />;
}

export default CustomerPortal;

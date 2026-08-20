import React from 'react';

export interface LandingTagItem {
  label: string;
  route?: string;
  tab?: string;
}

export interface TicketXLandingHubProps {
  onNavigate?: (tagItem: LandingTagItem) => void;
}

declare const TicketXLandingHub: React.FC<TicketXLandingHubProps>;
export default TicketXLandingHub;

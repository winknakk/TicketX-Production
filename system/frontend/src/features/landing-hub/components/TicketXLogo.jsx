import React from 'react';

/**
 * TicketX Custom Logo Component
 * Stylized geometric ticket stub with perforated edge details in solid black fill.
 */
export function TicketXLogo({ className = '', size = 24, fill = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`ticketx-logo-svg ${className}`}
      aria-label="TicketX Logo"
    >
      {/* Front Ticket Stub */}
      <path
        d="M6 8C6 6.89543 6.89543 6 8 6H24C25.1046 6 26 6.89543 26 8V12.5C24.6193 12.5 23.5 13.6193 23.5 15C23.5 16.3807 24.6193 17.5 26 17.5V24C26 25.1046 25.1046 26 24 26H8C6.89543 26 6 25.1046 6 24V17.5C7.38071 17.5 8.5 16.3807 8.5 15C8.5 13.6193 7.38071 12.5 6 12.5V8Z"
        fill={fill}
      />
      {/* Perforation line */}
      <line
        x1="13"
        y1="8"
        x2="13"
        y2="24"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      {/* Dynamic 'X' mark accent on stub */}
      <path
        d="M17 12L21 18M21 12L17 18"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default TicketXLogo;

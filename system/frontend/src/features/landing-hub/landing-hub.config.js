// LANDING HUB CONFIGURATION
// All route mappings, video URLs, and group definitions in one file.

export const LANDING_VIDEO_SOURCES = {
  greeting: "/assets/videos/hand-greeting-wai.mp4",     // TODO: replace with real asset
  nanoDissolve: "/assets/videos/hand-nano-dissolve.mp4", // TODO: replace with real asset
  okSign: "/assets/videos/hand-ok-sign.mp4",            // TODO: replace with real asset
};

export const ORBIT_AVATAR_IMAGES = [
  "/assets/avatars/1000007212.jpg",
  "/assets/avatars/2455.jpg",
  "/assets/avatars/2454.jpg",
];

export const GROUP_WELCOME_MESSAGES = {
  Operate: {
    title: "Welcome, Admin",
    subtitle: "TicketX AI Operations",
    badge: "Real-time Support Active",
  },
  Understand: {
    title: "Intelligence Hub",
    subtitle: "Analytics & Customer Insights",
    badge: "AI Analytics Active",
  },
  Configure: {
    title: "System Control",
    subtitle: "Workflows & Integrations",
    badge: "Configurations Active",
  },
};

// Fallback video URL used when local video assets do not exist yet in dev
export const LANDING_VIDEO_FALLBACK = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4";

export const STAGES = {
  GREETING: 'greeting',
  NANO_DISSOLVE: 'nanoDissolve',
  OK_SIGN: 'okSign',
};

export const MENU_GROUPS = {
  OPERATE: 'Operate',
  UNDERSTAND: 'Understand',
  CONFIGURE: 'Configure',
};

export const NAV_GROUP_MAPPINGS = {
  [MENU_GROUPS.OPERATE]: [
    { label: 'Conversations', route: '/conversations', tab: 'conversations' },
    { label: 'Tickets', route: '/tickets', tab: 'tickets' },
  ],
  [MENU_GROUPS.UNDERSTAND]: [
    { label: 'Customers', route: '/customers', tab: 'customers' },
    { label: 'Analytics', route: '/analytics', tab: 'analytics' },
    { label: 'Automation Traces', route: '/automation-traces', tab: 'traces' },
  ],
  [MENU_GROUPS.CONFIGURE]: [
    { label: 'Settings', route: '/settings', tab: 'settings' },
  ],
};

export const DEFAULT_ACTIVE_GROUP = MENU_GROUPS.OPERATE;


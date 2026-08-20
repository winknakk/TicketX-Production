# TicketX Landing Hub Feature

## Overview
This feature provides a full-screen, minimal black-and-white **Landing Hub Page** for **TicketX** (an AI-driven multi-channel customer support ticketing platform). It acts as the root entry point (`/`) of the application and serves as a dynamic navigation hub linking out to workspace pages (Overview, Conversations, Tickets, Customers, Analytics, Automation Traces, Settings).

### Background Visualization
The background layer uses **`OrbitAvatarField.jsx`** — an animated concentric circles visualization with 4 continuous rotating orbits (353px, 501px, 649px, 797px), alternating avatar images (`/assets/avatars/2455.jpg` and `/assets/avatars/2454.jpg`), entrance scale/blur/fly-in animations, and dynamic center metric counter reacting to navigation group selection (**Operate**, **Understand**, **Configure**).

*(Note: `LandingBackgroundVideo.jsx` remains in the codebase as an unused reference component).*

---

## Complete List of Created & Modified Files

### Created Files (Namespaced under `src/features/landing-hub/`)
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\TicketXLandingHub.jsx`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\TicketXLandingHub.css`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\OrbitAvatarField.jsx` (replaces background video)
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\OrbitAvatarField.css`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\LandingNavbar.jsx`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\LandingNavbar.css`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\NavDropdownMenu.jsx`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\NavDropdownMenu.css`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\LandingBackgroundVideo.jsx` (kept as unused fallback reference)
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\LandingBackgroundVideo.css`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\components\TicketXLogo.jsx`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\hooks\useLandingNavState.js`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\landing-hub.config.js`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\features\landing-hub\TicketXLandingHub.d.ts`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\public\assets\avatars\2454.jpg`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\public\assets\avatars\2455.jpg`
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\README-landing-hub.md`

### Modified Files
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\package.json` (added `motion` dependency)
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\App.tsx` (wired `/` route to `TicketXLandingHub` and sub-routes to workspace tabs)
- `d:\Works Core\TicketX_Main\TicketX\system\frontend\src\lib\navigation.ts` (updated route mappings for navigation)

---

## Routing Changes

- **Root Route (`/`)**: Renders the **TicketXLandingHub** page with top navbar, menu dropdown, dynamic tag pills, and orbiting circles visualization layer.
- **Workspace Named Routes**:
  - `/overview` or `#/dashboard`: Overview / Dashboard workspace
  - `/conversations` or `#/conversations`: Conversations workspace
  - `/tickets` or `#/tickets`: Tickets workspace
  - `/customers` or `#/customers`: Customers workspace
  - `/analytics` or `#/analytics`: Analytics workspace
  - `/automation-traces` or `#/traces`: Automation Traces workspace
  - `/settings` or `#/settings`: Settings workspace
  - `/app` or `/home`: Default workspace entry

---

## How to Roll Back / Remove Feature

To remove this feature and revert to loading the workspace dashboard directly at `/`:
1. Delete the `src/features/landing-hub/` directory and `README-landing-hub.md`.
2. In `src/App.tsx`, remove `import TicketXLandingHub from './features/landing-hub/TicketXLandingHub'` and revert the root route check so `tabFromLocation()` defaults directly to `'dashboard'`.

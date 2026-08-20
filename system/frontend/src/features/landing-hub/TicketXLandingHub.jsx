import React from 'react';
import LandingNavbar from './components/LandingNavbar';
import OrbitAvatarField from './components/OrbitAvatarField';
import { useLandingNavState } from './hooks/useLandingNavState';
import './TicketXLandingHub.css';

export function TicketXLandingHub({ onNavigate }) {
  const {
    activeGroup,
    isMenuOpen,
    selectedTag,
    currentTags,
    toggleMenu,
    closeMenu,
    selectGroup,
    selectTag,
  } = useLandingNavState(onNavigate);

  return (
    <div className="ticketx-landing-hub-root">
      {/* Animated Orbiting Concentric Circles Avatar Visualization */}
      <OrbitAvatarField activeGroup={activeGroup} />

      {/* Top Navbar Header */}
      <LandingNavbar
        activeGroup={activeGroup}
        isMenuOpen={isMenuOpen}
        selectedTag={selectedTag}
        currentTags={currentTags}
        onToggleMenu={toggleMenu}
        onCloseMenu={closeMenu}
        onSelectGroup={selectGroup}
        onSelectTag={selectTag}
      />

      {/* Main Content Area - Intentionally minimal with generous empty viewport space */}
      <main className="landing-hub-viewport-space" aria-label="TicketX Landing Hub">
        {/* Minimal composition: hero text, extra buttons, and footer blocks removed per design spec */}
      </main>
    </div>
  );
}

export default TicketXLandingHub;

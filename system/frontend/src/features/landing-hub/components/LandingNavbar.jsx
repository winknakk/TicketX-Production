import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TicketXLogo from './TicketXLogo';
import NavDropdownMenu from './NavDropdownMenu';
import './LandingNavbar.css';

export function LandingNavbar({
  activeGroup,
  isMenuOpen,
  selectedTag,
  currentTags,
  onToggleMenu,
  onCloseMenu,
  onSelectGroup,
  onSelectTag,
}) {
  return (
    <motion.nav
      className="landing-navbar-root"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="landing-navbar-left">
        {/* Logo & Brand */}
        <div className="landing-brand-wrapper">
          <TicketXLogo size={22} fill="#000000" />
          <span className="landing-brand-text">TicketX</span>
        </div>

        {/* Menu Dropdown */}
        <NavDropdownMenu
          activeGroup={activeGroup}
          isOpen={isMenuOpen}
          onToggle={onToggleMenu}
          onClose={onCloseMenu}
          onSelectGroup={onSelectGroup}
        />

        {/* Dynamic Tag Pills Container */}
        <div className="landing-tags-wrapper">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeGroup}
              className="landing-tags-container"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {currentTags.map((tag) => {
                const isTagActive = selectedTag === tag.label;
                return (
                  <button
                    key={tag.label}
                    type="button"
                    className={`landing-tag-pill ${isTagActive ? 'is-active' : ''}`}
                    onClick={() => onSelectTag(tag)}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right side is intentionally empty per specification */}
      <div className="landing-navbar-right" />
    </motion.nav>
  );
}

export default LandingNavbar;

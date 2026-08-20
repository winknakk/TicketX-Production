import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { MENU_GROUPS } from '../landing-hub.config';
import './NavDropdownMenu.css';

export function NavDropdownMenu({
  activeGroup,
  isOpen,
  onToggle,
  onClose,
  onSelectGroup,
}) {
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const groups = [
    { id: MENU_GROUPS.OPERATE, label: 'Operate', desc: 'Overview, Conversations, Tickets' },
    { id: MENU_GROUPS.UNDERSTAND, label: 'Understand', desc: 'Customers, Analytics, Traces' },
    { id: MENU_GROUPS.CONFIGURE, label: 'Configure', desc: 'Settings & Integrations' },
  ];

  return (
    <div className="nav-dropdown-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`menu-pill-button ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="menu-pill-label">Menu</span>
        <motion.span
          className="menu-chevron"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown size={12} strokeWidth={2.5} />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="dropdown-panel"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="dropdown-panel-inner" role="menu">
              {groups.map((group) => {
                const isActive = activeGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    role="menuitem"
                    className={`dropdown-item ${isActive ? 'is-active' : ''}`}
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <div className="dropdown-item-content">
                      <span className="dropdown-item-title">{group.label}</span>
                    </div>
                    {isActive && (
                      <span className="dropdown-item-check">
                        <Check size={14} strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NavDropdownMenu;

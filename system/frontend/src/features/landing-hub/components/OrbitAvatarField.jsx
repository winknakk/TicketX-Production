import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ORBIT_AVATAR_IMAGES, GROUP_WELCOME_MESSAGES } from '../landing-hub.config';
import './OrbitAvatarField.css';

// Orbit configuration with faster speeds (14s, 18s, 22s, 26s)
const ORBITS_CONFIG = [
  { id: 1, diameter: 353, speed: 14, direction: 'ccw' },
  { id: 2, diameter: 501, speed: 18, direction: 'cw' },
  { id: 3, diameter: 649, speed: 22, direction: 'cw' },
  { id: 4, diameter: 797, speed: 26, direction: 'ccw' },
];

// Avatars accurately distributed across orbit perimeters
const AVATARS_CONFIG = [
  // Orbit 1 (353px diameter)
  { id: 1, orbitId: 1, angle: 45, size: 68, isSquare: false, delay: 0.2 },
  { id: 2, orbitId: 1, angle: 225, size: 76, isSquare: true, delay: 0.3 },
  // Orbit 2 (501px diameter)
  { id: 3, orbitId: 2, angle: 0, size: 68, isSquare: false, delay: 0.35 },
  { id: 4, orbitId: 2, angle: 135, size: 76, isSquare: false, delay: 0.4 },
  { id: 5, orbitId: 2, angle: 270, size: 84, isSquare: true, delay: 0.5 },
  // Orbit 3 (649px diameter)
  { id: 6, orbitId: 3, angle: 45, size: 68, isSquare: true, delay: 0.6 },
  { id: 7, orbitId: 3, angle: 165, size: 80, isSquare: false, delay: 0.7 },
  { id: 8, orbitId: 3, angle: 285, size: 68, isSquare: false, delay: 0.8 },
  // Orbit 4 (797px diameter)
  { id: 9, orbitId: 4, angle: 30, size: 72, isSquare: false, delay: 0.85 },
  { id: 10, orbitId: 4, angle: 120, size: 68, isSquare: false, delay: 0.9 },
  { id: 11, orbitId: 4, angle: 210, size: 76, isSquare: true, delay: 0.95 },
  { id: 12, orbitId: 4, angle: 300, size: 68, isSquare: false, delay: 1.0 },
];

export function OrbitAvatarField({ activeGroup = 'Operate', pulseTrigger }) {
  const welcomeMsg = GROUP_WELCOME_MESSAGES[activeGroup] || GROUP_WELCOME_MESSAGES.Operate;
  const [pulse, setPulse] = useState(false);
  const [hoveredAvatarId, setHoveredAvatarId] = useState(null);
  const [zoomScales, setZoomScales] = useState({});

  useEffect(() => {
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 450);
    return () => clearTimeout(timer);
  }, [activeGroup, pulseTrigger]);

  const handleMouseEnter = (avatarId) => {
    setHoveredAvatarId(avatarId);
    setZoomScales((prev) => ({ ...prev, [avatarId]: prev[avatarId] || 1.75 }));
  };

  const handleMouseLeave = (avatarId) => {
    setHoveredAvatarId(null);
    setZoomScales((prev) => {
      const next = { ...prev };
      delete next[avatarId];
      return next;
    });
  };

  const handleWheel = (e, avatarId) => {
    e.preventDefault();
    e.stopPropagation();
    setZoomScales((prev) => {
      const currentScale = prev[avatarId] || 1.75;
      const step = e.deltaY < 0 ? 0.3 : -0.3;
      const nextScale = Math.min(Math.max(currentScale + step, 1.2), 4.5);
      return { ...prev, [avatarId]: nextScale };
    });
  };

  return (
    <div className="orbit-field-bg-layer">
      <motion.div
        className="orbit-field-scaler"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: pulse ? 1.03 : 1 }}
        transition={{
          opacity: { duration: 1.0, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
          scale: pulse
            ? { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
            : { duration: 1.0, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
        }}
      >
        <div className="orbit-field-container">
          {/* 4 Concentric Orbit Rings & Avatars */}
          {ORBITS_CONFIG.map((orbit) => {
            const isCCW = orbit.direction === 'ccw';
            const orbitAvatars = AVATARS_CONFIG.filter((a) => a.orbitId === orbit.id);

            return (
              <div
                key={orbit.id}
                className={`orbit-ring-container ${isCCW ? 'spin-ccw' : 'spin-cw'}`}
                style={{
                  width: `${orbit.diameter}px`,
                  height: `${orbit.diameter}px`,
                  animationDuration: `${orbit.speed}s`,
                }}
              >
                {/* 1px Ring Border */}
                <div className="orbit-ring-line" />

                {/* Avatars on this Orbit Ring */}
                {orbitAvatars.map((avatar) => {
                  const rad = (avatar.angle * Math.PI) / 180;
                  const leftPercent = 50 + 50 * Math.cos(rad);
                  const topPercent = 50 + 50 * Math.sin(rad);
                  const avatarIndex = AVATARS_CONFIG.findIndex((a) => a.id === avatar.id);
                  const imgSrc = ORBIT_AVATAR_IMAGES[avatarIndex % ORBIT_AVATAR_IMAGES.length];
                  const isHovered = hoveredAvatarId === avatar.id;
                  const currentScale = isHovered ? (zoomScales[avatar.id] || 1.75) : 1;

                  return (
                    <div
                      key={avatar.id}
                      className="orbit-avatar-positioner"
                      style={{
                        left: `${leftPercent}%`,
                        top: `${topPercent}%`,
                      }}
                    >
                      <div
                        className={`orbit-avatar-counter-spin ${isCCW ? 'counter-spin-ccw' : 'counter-spin-cw'}`}
                        style={{ animationDuration: `${orbit.speed}s` }}
                      >
                        <motion.div
                          className={`orbit-avatar-card ${avatar.isSquare ? 'is-square' : ''}`}
                          style={{
                            width: `${avatar.size}px`,
                            height: `${avatar.size}px`,
                          }}
                          initial={{ scale: 0, opacity: 0, filter: 'blur(4px)' }}
                          animate={{
                            scale: currentScale,
                            opacity: 1,
                            filter: 'blur(0px)',
                            zIndex: isHovered ? 999 : 1,
                            boxShadow: isHovered
                              ? '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 4px #ffffff'
                              : '0 4px 12px rgba(0,0,0,0.1)',
                          }}
                          transition={{
                            scale: isHovered ? { type: 'spring', stiffness: 350, damping: 25 } : { duration: 0.3 },
                            opacity: { duration: 0.6, delay: avatar.delay },
                          }}
                          onMouseEnter={() => handleMouseEnter(avatar.id)}
                          onMouseLeave={() => handleMouseLeave(avatar.id)}
                          onWheel={(e) => handleWheel(e, avatar.id)}
                        >
                          <img
                            src={imgSrc}
                            alt="TicketX Specialist Avatar"
                            className="orbit-avatar-img"
                          />
                        </motion.div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Center Welcome Header */}
          <div className="orbit-center-node">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeGroup}
                className="orbit-center-content"
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="orbit-center-badge">
                  <span className="orbit-badge-dot" />
                  <span className="orbit-badge-text">{welcomeMsg.badge}</span>
                </div>
                <h1 className="orbit-center-title">{welcomeMsg.title}</h1>
                <p className="orbit-center-subtitle">{welcomeMsg.subtitle}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default OrbitAvatarField;

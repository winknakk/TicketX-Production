import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LANDING_VIDEO_SOURCES,
  LANDING_VIDEO_FALLBACK,
  STAGES,
} from '../landing-hub.config';
import './LandingBackgroundVideo.css';

export function LandingBackgroundVideo({ stage, onStageComplete }) {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);

  // Determine current video URL
  const videoUrl = videoError
    ? LANDING_VIDEO_FALLBACK
    : LANDING_VIDEO_SOURCES[stage] || LANDING_VIDEO_FALLBACK;

  const isLooping = stage === STAGES.OK_SIGN;

  // Handle video end event for staged sequence (Greeting -> Nano Dissolve)
  const handleEnded = () => {
    if (onStageComplete) {
      onStageComplete(stage);
    }
  };

  // Fallback timer if video asset is missing or cannot play to trigger state progression
  useEffect(() => {
    let timer;
    if (stage === STAGES.GREETING) {
      timer = setTimeout(() => {
        if (onStageComplete) onStageComplete(STAGES.GREETING);
      }, 3500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [stage, onStageComplete]);

  const handleError = () => {
    if (!videoError) {
      setVideoError(true);
    }
  };

  return (
    <motion.div
      className="landing-bg-layer"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="landing-video-container">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage + (videoError ? '-fallback' : '')}
            className="landing-video-motion-wrapper"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              muted
              playsInline
              loop={isLooping}
              onEnded={handleEnded}
              onError={handleError}
              className="landing-video-element"
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default LandingBackgroundVideo;

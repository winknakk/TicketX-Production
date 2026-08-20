import { useState, useCallback } from 'react';
import {
  DEFAULT_ACTIVE_GROUP,
  NAV_GROUP_MAPPINGS,
  STAGES,
} from '../landing-hub.config';

export function useLandingNavState(onNavigateCallback) {
  const [activeGroup, setActiveGroup] = useState(DEFAULT_ACTIVE_GROUP);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [videoStage, setVideoStage] = useState(STAGES.GREETING);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const selectGroup = useCallback((groupName) => {
    setActiveGroup(groupName);
    setIsMenuOpen(false);
  }, []);

  const handleStageComplete = useCallback((completedStage) => {
    if (completedStage === STAGES.GREETING) {
      setVideoStage(STAGES.NANO_DISSOLVE);
    }
  }, []);

  const selectTag = useCallback(
    (tagItem) => {
      setSelectedTag(tagItem.label);
      setVideoStage(STAGES.OK_SIGN);

      if (typeof onNavigateCallback === 'function') {
        onNavigateCallback(tagItem);
      } else {
        // Fallback standard navigation via window location hash or path
        if (tagItem.route) {
          window.location.hash = `#${tagItem.route}`;
        }
      }
    },
    [onNavigateCallback]
  );

  const currentTags = NAV_GROUP_MAPPINGS[activeGroup] || [];

  return {
    activeGroup,
    isMenuOpen,
    selectedTag,
    videoStage,
    currentTags,
    toggleMenu,
    closeMenu,
    selectGroup,
    selectTag,
    handleStageComplete,
    setVideoStage,
  };
}

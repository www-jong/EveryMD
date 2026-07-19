import { useEffect } from 'react';
import { useFileSystem } from './useFileSystem';
import { useTheme } from './useTheme';
import { useFileStore } from '../stores/fileStore';

export const useKeyboard = () => {
  const { handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab } = useFileSystem();
  const { toggleTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (!cmdKey) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          handleNew();
          break;
        case 'o':
          e.preventDefault();
          handleOpen();
          break;
        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            handleSaveAs();
          } else {
            handleSave();
          }
          break;
        case 'w':
          e.preventDefault();
          const activeTabId = useFileStore.getState().activeTabId;
          if (activeTabId) handleCloseTab(activeTabId);
          break;
        case 'l':
          if (e.shiftKey) {
            e.preventDefault();
            toggleTheme();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab, toggleTheme]);
};

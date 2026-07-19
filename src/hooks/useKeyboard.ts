import { useEffect } from 'react';
import { useFileSystem } from './useFileSystem';
import { useTheme } from './useTheme';
import { useFileStore } from '../stores/fileStore';
import { useSettingsStore } from '../stores/settingsStore';

interface UseKeyboardProps {
  onToggleSidebar?: () => void;
}

export const useKeyboard = ({ onToggleSidebar }: UseKeyboardProps = {}) => {
  const { handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab } = useFileSystem();
  const { toggleTheme } = useTheme();
  
  const setSettingsOpen = useSettingsStore((state) => state.setSettingsOpen);
  const isSettingsOpen = useSettingsStore((state) => state.isSettingsOpen);
  const shortcuts = useSettingsStore((state) => state.shortcuts);

  useEffect(() => {
    // 키보드 이벤트를 "ctrl+shift+s" 형태의 문자열 조합으로 변환하는 함수
    const parseEventToShortcut = (e: KeyboardEvent): string => {
      const parts: string[] = [];
      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      
      // 알파벳이나 쉼표(,), 마침표(.) 등 식별 가능한 단일 키
      let key = e.key.toLowerCase();
      
      // 브라우저 쉼표 매핑 표준화
      if (key === ',') key = ',';
      
      // modifier 단독 입력을 차단하기 위한 필터
      if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
        parts.push(key);
      }
      
      return parts.join('+');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const combination = parseEventToShortcut(e);
      if (!combination) return;

      // 1. 새 문서 단축키 매칭
      if (combination === shortcuts.newFile) {
        e.preventDefault();
        handleNew();
        return;
      }

      // 2. 문서 열기 단축키 매칭
      if (combination === shortcuts.openFile) {
        e.preventDefault();
        handleOpen();
        return;
      }

      // 3. 다른 이름으로 저장 단축키 매칭
      if (combination === shortcuts.saveAsFile) {
        e.preventDefault();
        handleSaveAs();
        return;
      }

      // 4. 저장 단축키 매칭
      if (combination === shortcuts.saveFile) {
        e.preventDefault();
        handleSave();
        return;
      }

      // 5. 탭 닫기 단축키 매칭
      if (combination === shortcuts.closeTab) {
        e.preventDefault();
        const activeTabId = useFileStore.getState().activeTabId;
        if (activeTabId) handleCloseTab(activeTabId);
        return;
      }

      // 6. 테마 전환 단축키 매칭
      if (combination === shortcuts.toggleTheme) {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // 7. 사이드바 토글 단축키 매칭
      if (combination === shortcuts.toggleSidebar) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // 8. 설정창 토글 단축키 매칭
      if (combination === shortcuts.openSettings) {
        e.preventDefault();
        setSettingsOpen(!isSettingsOpen);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNew, 
    handleOpen, 
    handleSave, 
    handleSaveAs, 
    handleCloseTab, 
    toggleTheme, 
    setSettingsOpen, 
    isSettingsOpen, 
    onToggleSidebar,
    shortcuts
  ]);
};

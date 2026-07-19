import React, { useState, useEffect, useRef } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useSettingsStore, THEME_PRESETS } from '../../stores/settingsStore';
import { useFileSystem } from '../../hooks/useFileSystem';
import './MenuBar.css';

export const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);

  const { handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab } = useFileSystem();
  const { shortcuts, customThemes, activeThemeId, setActiveThemeId } = useSettingsStore();
  const activeTabId = useFileStore((state) => state.activeTabId);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleMenuClick = (menuName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuHover = (menuName: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  const triggerAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (editorEl) {
      editorEl.focus();
      document.execCommand('insertText', false, prefix + suffix);
      editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      alert('활성화된 입력창이 없습니다.');
    }
    setActiveMenu(null);
  };

  // 단축키 대문자 정리용 헬퍼
  const formatShortcut = (combo: string): string => {
    return combo.split('+')
      .map(k => k.charAt(0).toUpperCase() + k.slice(1))
      .join('+');
  };

  return (
    <div className="menubar-container" ref={menuBarRef}>
      {/* 파일 메뉴 */}
      <div className={`menu-group ${activeMenu === 'file' ? 'open' : ''}`}>
        <button 
          className="menu-trigger" 
          onClick={(e) => handleMenuClick('file', e)}
          onMouseEnter={() => handleMenuHover('file')}
        >
          파일
        </button>
        <div className="dropdown-menu">
          <div className="dropdown-item" onClick={() => triggerAction(handleNew)}>
            <span>새 파일</span><kbd>{formatShortcut(shortcuts.newFile)}</kbd>
          </div>
          <div className="dropdown-item" onClick={() => triggerAction(handleOpen)}>
            <span>열기...</span><kbd>{formatShortcut(shortcuts.openFile)}</kbd>
          </div>
          <div className="dropdown-divider" />
          <div className="dropdown-item" onClick={() => triggerAction(handleSave)}>
            <span>저장</span><kbd>{formatShortcut(shortcuts.saveFile)}</kbd>
          </div>
          <div className="dropdown-item" onClick={() => triggerAction(handleSaveAs)}>
            <span>다른 이름으로 저장...</span><kbd>{formatShortcut(shortcuts.saveAsFile)}</kbd>
          </div>
          <div className="dropdown-divider" />
          <div className="dropdown-item" onClick={() => triggerAction(() => useSettingsStore.getState().setSettingsOpen(true))}>
            <span>설정 (Preferences)...</span><kbd>{formatShortcut(shortcuts.openSettings)}</kbd>
          </div>
          <div className="dropdown-divider" />
          <div className="dropdown-item" onClick={() => {
            if (activeTabId) handleCloseTab(activeTabId);
            setActiveMenu(null);
          }}>
            <span>현재 탭 닫기</span><kbd>{formatShortcut(shortcuts.closeTab)}</kbd>
          </div>
        </div>
      </div>

      {/* 편집 메뉴 */}
      <div className={`menu-group ${activeMenu === 'edit' ? 'open' : ''}`}>
        <button 
          className="menu-trigger" 
          onClick={(e) => handleMenuClick('edit', e)}
          onMouseEnter={() => handleMenuHover('edit')}
        >
          편집
        </button>
        <div className="dropdown-menu">
          <div className="dropdown-item" onClick={() => insertFormat('', '')}>
            <span>되돌리기 (Undo)</span><kbd>Ctrl+Z</kbd>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('', '')}>
            <span>다시 실행 (Redo)</span><kbd>Ctrl+Y</kbd>
          </div>
          <div className="dropdown-divider" />
          <div className="dropdown-item" onClick={() => insertFormat('', '')}>
            <span>복사</span><kbd>Ctrl+C</kbd>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('', '')}>
            <span>붙여넣기</span><kbd>Ctrl+V</kbd>
          </div>
        </div>
      </div>

      {/* 본문 메뉴 */}
      <div className={`menu-group ${activeMenu === 'paragraph' ? 'open' : ''}`}>
        <button 
          className="menu-trigger" 
          onClick={(e) => handleMenuClick('paragraph', e)}
          onMouseEnter={() => handleMenuHover('paragraph')}
        >
          본문
        </button>
        <div className="dropdown-menu">
          <div className="dropdown-item" onClick={() => insertFormat('# ', '')}>
            <span>제목 1 (H1)</span>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('## ', '')}>
            <span>제목 2 (H2)</span>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('### ', '')}>
            <span>제목 3 (H3)</span>
          </div>
          <div className="dropdown-divider" />
          <div className="dropdown-item" onClick={() => insertFormat('> ', '')}>
            <span>인용구</span>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('```markdown\n', '\n```')}>
            <span>코드 블록</span>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('| 제목 1 | 제목 2 |\n| --- | --- |\n', '')}>
            <span>표 (Table)</span>
          </div>
        </div>
      </div>

      {/* 서식 메뉴 */}
      <div className={`menu-group ${activeMenu === 'format' ? 'open' : ''}`}>
        <button 
          className="menu-trigger" 
          onClick={(e) => handleMenuClick('format', e)}
          onMouseEnter={() => handleMenuHover('format')}
        >
          서식
        </button>
        <div className="dropdown-menu">
          <div className="dropdown-item" onClick={() => insertFormat('**', '**')}>
            <span>굵게 (Bold)</span><kbd>Ctrl+B</kbd>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('*', '*')}>
            <span>기울임 (Italic)</span><kbd>Ctrl+I</kbd>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('~~', '~~')}>
            <span>취소선</span>
          </div>
          <div className="dropdown-item" onClick={() => insertFormat('`', '`')}>
            <span>인라인 코드</span>
          </div>
        </div>
      </div>

      {/* 테마 메뉴 (모든 활성 프리셋 및 커스텀 테마를 상단바 메뉴에 동적 렌더링!) */}
      <div className={`menu-group ${activeMenu === 'theme' ? 'open' : ''}`}>
        <button 
          className="menu-trigger" 
          onClick={(e) => handleMenuClick('theme', e)}
          onMouseEnter={() => handleMenuHover('theme')}
        >
          테마
        </button>
        <div className="dropdown-menu">
          {/* A. 프리셋 목록 */}
          {Object.entries(THEME_PRESETS).map(([id, t]) => (
            <div 
              key={id}
              className={`dropdown-item ${activeThemeId === id ? 'selected' : ''}`} 
              onClick={() => triggerAction(() => setActiveThemeId(id))}
            >
              <span>{t.isDark ? '🌙' : '☀️'} {t.name}</span>
            </div>
          ))}
          {/* B. 커스텀 테마 목록 */}
          {customThemes.length > 0 && (
            <>
              <div className="dropdown-divider" />
              {customThemes.map((t) => (
                <div 
                  key={t.id}
                  className={`dropdown-item ${activeThemeId === t.id ? 'selected' : ''}`} 
                  onClick={() => triggerAction(() => setActiveThemeId(t.id))}
                >
                  <span>🛠️ {t.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 도움말 메뉴 */}
      <div className={`menu-group ${activeMenu === 'help' ? 'open' : ''}`}>
        <button 
          className="menu-trigger" 
          onClick={(e) => handleMenuClick('help', e)}
          onMouseEnter={() => handleMenuHover('help')}
        >
          도움말
        </button>
        <div className="dropdown-menu">
          <div className="dropdown-item" onClick={() => triggerAction(() => alert('EveryMD v0.1.0\n크로스플랫폼 WYSIWYG 마크다운 에디터\n\n© 2026 EveryMD Team.'))}>
            <span>EveryMD 정보</span>
          </div>
        </div>
      </div>
    </div>
  );
};

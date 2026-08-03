import React, { useState, useEffect, useRef } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useFileStore } from '../../stores/fileStore';
import { useSettingsStore, THEME_PRESETS } from '../../stores/settingsStore';
import { useFileSystem } from '../../hooks/useFileSystem';
import './MenuBar.css';

export const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
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
    }
    setActiveMenu(null);
  };

  const formatShortcut = (combo: string): string => {
    return combo.split('+')
      .map(k => k.charAt(0).toUpperCase() + k.slice(1))
      .join('+');
  };

  return (
    <>
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
            <div className="dropdown-item" onClick={() => { document.execCommand('undo'); setActiveMenu(null); }}>
              <span>되돌리기 (Undo)</span><kbd>Ctrl+Z</kbd>
            </div>
            <div className="dropdown-item" onClick={() => { document.execCommand('redo'); setActiveMenu(null); }}>
              <span>다시 실행 (Redo)</span><kbd>Ctrl+Y</kbd>
            </div>
            <div className="dropdown-divider" />
            <div className="dropdown-item" onClick={() => { document.execCommand('copy'); setActiveMenu(null); }}>
              <span>복사</span><kbd>Ctrl+C</kbd>
            </div>
            <div className="dropdown-item" onClick={() => { document.execCommand('paste'); setActiveMenu(null); }}>
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

        {/* 테마 메뉴 */}
        <div className={`menu-group ${activeMenu === 'theme' ? 'open' : ''}`}>
          <button
            className="menu-trigger"
            onClick={(e) => handleMenuClick('theme', e)}
            onMouseEnter={() => handleMenuHover('theme')}
          >
            테마
          </button>
          <div className="dropdown-menu">
            {Object.entries(THEME_PRESETS).map(([id, t]) => (
              <div
                key={id}
                className={`dropdown-item ${activeThemeId === id ? 'selected' : ''}`}
                onClick={() => triggerAction(() => setActiveThemeId(id))}
              >
                <span>{t.isDark ? '🌙' : '☀️'} {t.name}</span>
              </div>
            ))}
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
            <div className="dropdown-item" onClick={() => triggerAction(() => setShowAbout(true))}>
              <span>EveryMD 정보</span>
            </div>
          </div>
        </div>
      </div>

      {/* About 커스텀 모달 — Windows 알림/alert 없이 앱 내부 UI로 표시 */}
      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={(e) => e.stopPropagation()}>
            <div className="about-logo">📝</div>
            <h2 className="about-name">EveryMD</h2>
            <p className="about-version">v0.1.1</p>
            <p className="about-desc">크로스플랫폼 WYSIWYG 마크다운 에디터</p>
            <div className="about-divider" />
            <p className="about-author">개발자: <strong>www-jong</strong></p>
            <button
              className="about-github-btn"
              onClick={() => openUrl('https://github.com/www-jong/EveryMD').catch(console.error)}
            >
              🔗 github.com/www-jong/EveryMD
            </button>
            <p className="about-license">© 2026 www-jong · MIT License</p>
            <button className="about-close-btn" onClick={() => setShowAbout(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
};

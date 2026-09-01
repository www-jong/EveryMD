import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TitleBar } from './components/TitleBar/TitleBar';
import { MenuBar } from './components/MenuBar/MenuBar';
import { TabBar } from './components/TabBar/TabBar';
import { FileExplorer } from './components/Sidebar/FileExplorer';
import { MarkdownEditor } from './components/Editor/MarkdownEditor';
import { StatusBar } from './components/StatusBar/StatusBar';
import { SettingsModal } from './components/Settings/SettingsModal';
import { ConflictModal } from './components/Modal/ConflictModal';
import { useKeyboard } from './hooks/useKeyboard';
import { useTheme } from './hooks/useTheme';
import { useFileAssociation } from './hooks/useFileAssociation';
import { useFileWatcher } from './hooks/useFileWatcher';
import { useFileSystem } from './hooks/useFileSystem';
import { useFileStore } from './stores/fileStore';
import { useSettingsStore } from './stores/settingsStore';
import { openUrl } from '@tauri-apps/plugin-opener';
import { formatShortcut } from './utils/shortcut';
import { readFile, writeFile, isTauri, baseName, SUPPORTED_EXTENSIONS } from './utils/fileSystem';

const App: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const toggleSidebar = () => setSidebarVisible((v) => !v);

  const { handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab } = useFileSystem();
  useKeyboard({ onToggleSidebar: toggleSidebar });
  useTheme();
  useFileAssociation();
  const { conflictInfo, resolveConflict } = useFileWatcher();
  
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const openFile = useFileStore((state) => state.openFile);
  const updateContent = useFileStore((state) => state.updateContent);
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;
  const { isSettingsOpen, setSettingsOpen, wordWrap, toggleTheme, setFontSize } = useSettingsStore();

  // macOS 네이티브 시스템 메뉴바 이벤트 구독
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | null = null;
    getCurrentWindow()
      .listen<string>('menu-event', (event) => {
        const actionId = event.payload;
        switch (actionId) {
          case 'settings':
            setSettingsOpen(true);
            break;
          case 'new_file':
            handleNew();
            break;
          case 'open_file':
            handleOpen();
            break;
          case 'save_file':
            handleSave();
            break;
          case 'save_as_file':
            handleSaveAs();
            break;
          case 'close_tab': {
            const curActiveId = useFileStore.getState().activeTabId;
            if (curActiveId) handleCloseTab(curActiveId);
            break;
          }
          case 'toggle_sidebar':
            toggleSidebar();
            break;
          case 'toggle_theme':
            toggleTheme();
            break;
          case 'zoom_in':
            setFontSize(Math.min(32, useSettingsStore.getState().fontSize + 2));
            break;
          case 'zoom_out':
            setFontSize(Math.max(12, useSettingsStore.getState().fontSize - 2));
            break;
          case 'zoom_reset':
            setFontSize(16);
            break;
          case 'open_github':
            openUrl('https://github.com/www-jong/EveryMD');
            break;
          case 'open_release_notes':
            openUrl('https://github.com/www-jong/EveryMD/releases');
            break;
          default:
            break;
        }
      })
      .then((unsub) => {
        unlisten = unsub;
      })
      .catch((err) => {
        console.error('메뉴 이벤트 리스너 등록 실패:', err);
      });

    return () => {
      unlisten?.();
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab, setSettingsOpen, toggleTheme, setFontSize]);

  // 재시작 시 복원된 탭 중 디스크 파일의 내용이 비어 있는 것들을 읽어 채움
  useEffect(() => {
    const { tabs: restored, hydrateTab: hydrate } = useFileStore.getState();
    restored
      .filter((t) => t.filePath && !t.content)
      .forEach((t) => {
        readFile(t.filePath!)
          .then((content) => hydrate(t.id, content))
          .catch(() => {
            // 파일이 삭제되었거나 접근 불가한 경우 빈 문서로 유지
          });
      });
    // 마운트 시 1회만 실행
  }, []);

  // URL 쿼리 파라미터 감지하여 새 창 독립 실행 시 지정된 파일 자동 오픈
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openFilePath = params.get('openFile');
    if (openFilePath) {
      // 쿼리에 오픈할 파일명이 전달된 경우 즉시 읽어서 탭에 마운트
      const fileName = baseName(openFilePath);
      readFile(openFilePath)
        .then((content) => {
          openFile(openFilePath, content, fileName);
          // 새 창 독립 파일 로드 시에는 탐색기 사이드바를 숨겨서 글쓰기에 집중하게 지원 (Typora standard)
          setSidebarVisible(false);
        })
        .catch((err) => {
          console.error('독립 실행 창 파일 오픈 실패:', err);
        });
    }
  }, [openFile]);

  const handleEditorChange = useCallback((markdown: string) => {
    const curActiveId = useFileStore.getState().activeTabId;
    if (curActiveId) {
      updateContent(curActiveId, markdown);
    }
  }, [updateContent]);

  // ─── Auto-Save (debounced) ─────────────────────────────────────────────────
  const { autoSave, autoSaveDelay } = useSettingsStore();
  const markSaved = useFileStore((state) => state.markSaved);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoSave || !activeTab?.isDirty || !activeTab?.filePath) return;

    // 이전 타이머 취소 후 새 타이머 시작 (debounce)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      if (!activeTab?.filePath || !activeTab?.isDirty) return;
      try {
        await writeFile(activeTab.filePath, activeTab.content);
        markSaved(activeTab.id, activeTab.filePath, activeTab.content);
      } catch (err) {
        console.error('Auto-save 실패:', err);
      }
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeTab?.content, activeTab?.id, activeTab?.filePath, activeTab?.isDirty, autoSave, autoSaveDelay, markSaved]);

  // 탭 전환/창 닫기 시 대기 중이던 자동저장을 즉시 플러시
  // (cleanup은 deps 변경 전의 값을 클로저로 가지므로 "이전 탭" 기준으로 저장됨)
  useEffect(() => {
    const tabOnMount = useFileStore.getState().tabs.find((t) => t.id === activeTabId) || null;
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (!useSettingsStore.getState().autoSave || !tabOnMount?.isDirty || !tabOnMount.filePath) return;
      const latest = useFileStore.getState().tabs.find((t) => t.id === tabOnMount.id);
      if (!latest?.isDirty || !latest.filePath) return;
      writeFile(latest.filePath, latest.content)
        .then(() => useFileStore.getState().markSaved(latest.id, latest.filePath!, latest.content))
        .catch((err) => console.error('자동저장 플러시 실패:', err));
    };
  }, [activeTabId]);

  // 창 닫기 시 미저장 변경사항 경고 (타이틀바 X, OS 닫기, Alt+F4 모두 인터셉트)
  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | null = null;

    getCurrentWindow()
      .onCloseRequested(async (event) => {
        const hasDirty = useFileStore.getState().tabs.some((t) => t.isDirty);
        if (!hasDirty) return;

        event.preventDefault();
        const confirmed = window.confirm(
          '저장되지 않은 변경사항이 있습니다.\n그래도 창을 닫으시겠습니까?'
        );
        if (confirmed) {
          await getCurrentWindow().destroy();
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // ─── 드래그 앤 드롭 ─────────────────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCount, setDragCount] = useState(0);

  // Tauri 환경: OS 네이티브 드래그앤드롭 이벤트 사용 (실제 파일 경로 획득)
  useEffect(() => {
    if (!isTauri()) return;

    const extPattern = new RegExp(`\\.(${SUPPORTED_EXTENSIONS.join('|')})$`, 'i');
    let disposed = false;
    let unlisten: (() => void) | null = null;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === 'enter') {
          setDragCount(payload.paths.filter((p) => extPattern.test(p)).length);
          setIsDragOver(true);
        } else if (payload.type === 'over') {
          setIsDragOver(true);
        } else if (payload.type === 'leave') {
          setIsDragOver(false);
          setDragCount(0);
        } else if (payload.type === 'drop') {
          setIsDragOver(false);
          setDragCount(0);

          payload.paths
            .filter((p) => extPattern.test(p))
            .forEach((p) => {
              readFile(p)
                .then((content) => openFile(p, content, baseName(p)))
                .catch((err) => console.error('드롭 파일 열기 실패:', err));
            });

          const skipped = payload.paths.length - payload.paths.filter((p) => extPattern.test(p)).length;
          if (skipped > 0) {
            alert('.md, .txt, .markdown 파일만 열 수 있습니다. 지원하지 않는 파일은 건너뛰었습니다.');
          }
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openFile]);

  // 브라우저 데모 모드용 HTML5 폴백 (Tauri에서는 네이티브 핸들러가 처리)
  const handleDragOver = (e: React.DragEvent) => {
    if (isTauri()) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isTauri()) return;
    // 자식 요소로 이동 시 오발 방지
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (isTauri()) return; // Tauri에서는 네이티브 onDragDropEvent가 담당
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const supported = files.filter(f => /\.(md|txt|markdown)$/i.test(f.name));

    if (files.length > 0 && supported.length === 0) {
      alert('\.md, .txt, .markdown 파일만 드래그하여 열 수 있습니다.');
      return;
    }

    for (const file of supported) {
      // 브라우저에서는 FileReader로 직접 읽기 (file.path는 존재하지 않음)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string || '';
        openFile(file.name, content, file.name);
      };
      reader.readAsText(file, 'utf-8');
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const onReSaveDeletedFile = async () => {
    await handleSave();
    showToast(`💾 '${activeTab?.title}' 파일이 디스크에 다시 저장되었습니다.`);
  };

  // ─── 타이틀바에 현재 파일명 반영 ─────────────────────────────────────────
  useEffect(() => {
    const fileName = activeTab?.title || 'EveryMD';
    const dirty = activeTab?.isDirty ? '● ' : '';
    document.title = `${dirty}${fileName} — EveryMD`;
  }, [activeTab?.title, activeTab?.isDirty]);

  return (
    <>
      <TitleBar />
      <MenuBar />
      <TabBar />
      <div className="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {sidebarVisible && <FileExplorer />}
        <button
          onClick={toggleSidebar}
          style={{
            width: '16px', border: 'none', cursor: 'pointer',
            background: 'var(--bg-sidebar)', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', padding: 0, borderLeft: '1px solid var(--border-color)',
            borderRight: '1px solid var(--border-color)',
            flexShrink: 0
          }}
          title={`사이드바 토글 (${formatShortcut('ctrl+\\')})`}
        >
          {sidebarVisible ? '◀' : '▶'}
        </button>
        
        <div 
          className={`editor-wrapper-layout ${!wordWrap ? 'word-wrap-disabled' : ''}${isDragOver ? ' drag-over' : ''}`}
          style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '2px dashed var(--accent-color)',
              borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              backdropFilter: 'blur(2px)'
            }}>
              <div style={{
                color: 'var(--accent-color)', fontSize: '18px', fontWeight: 600,
                background: 'var(--bg-main)', padding: '12px 24px', borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }}>
                파일 {dragCount > 1 ? `${dragCount}개` : ''}를 놓아 바로 열기 (.md / .txt)
              </div>
            </div>
          )}

          {/* 디스크 소실/삭제 경고 배너 */}
          {activeTab?.isDeletedFromDisk && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5',
              fontSize: '12.5px', zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>⚠️</span>
                <span>이 파일은 디스크(또는 브랜치)에서 삭제되었습니다. 현재 편집본을 보존하시겠습니까?</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onReSaveDeletedFile}
                  style={{
                    padding: '4px 10px', fontSize: '11.5px', fontWeight: 600,
                    background: '#ef4444', color: '#fff', border: 'none',
                    borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  디스크에 다시 저장 ({formatShortcut('ctrl+s')})
                </button>
                <button
                  onClick={handleSaveAs}
                  style={{
                    padding: '4px 10px', fontSize: '11.5px', fontWeight: 500,
                    background: 'var(--bg-main)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  다른 이름으로 저장
                </button>
              </div>
            </div>
          )}

          {activeTab ? (
            <MarkdownEditor
              key={activeTab.id}
              content={activeTab.content}
              onChange={handleEditorChange}
            />
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              파일을 열거나 새 파일을 만드세요 ({formatShortcut('ctrl+n')} / {formatShortcut('ctrl+o')} / 설정: {formatShortcut('ctrl+,')})
            </div>
          )}
        </div>
      </div>
      <StatusBar onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConflictModal conflict={conflictInfo} onClose={resolveConflict} />

      {/* 저장 피드백 토스트 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '36px', right: '20px', zIndex: 999999,
          background: 'var(--bg-sidebar, #1e1e2e)', color: 'var(--text-primary, #cdd6f4)',
          border: '1px solid var(--accent-color, #89b4fa)', padding: '8px 16px',
          borderRadius: '6px', fontSize: '12px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          {toastMessage}
        </div>
      )}
    </>
  );
};

export default App;

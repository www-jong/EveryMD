import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { TitleBar } from './components/TitleBar/TitleBar';
import { MenuBar } from './components/MenuBar/MenuBar';
import { TabBar } from './components/TabBar/TabBar';
import { FileExplorer } from './components/Sidebar/FileExplorer';
import { MarkdownEditor } from './components/Editor/MarkdownEditor';
import { StatusBar } from './components/StatusBar/StatusBar';
import { SettingsModal } from './components/Settings/SettingsModal';
import { useKeyboard } from './hooks/useKeyboard';
import { useTheme } from './hooks/useTheme';
import { useFileStore } from './stores/fileStore';
import { useSettingsStore } from './stores/settingsStore';
import { readFile, writeFile, isTauri, baseName, SUPPORTED_EXTENSIONS } from './utils/fileSystem';

const App: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const toggleSidebar = () => setSidebarVisible((v) => !v);

  useKeyboard({ onToggleSidebar: toggleSidebar });
  useTheme();
  
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const openFile = useFileStore((state) => state.openFile);
  const updateContent = useFileStore((state) => state.updateContent);
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;
  const { isSettingsOpen, setSettingsOpen, wordWrap } = useSettingsStore();

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
    if (activeTab) {
      updateContent(activeTab.id, markdown);
    }
  }, [activeTab, updateContent]);

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
        markSaved(activeTab.id, activeTab.filePath);
      } catch (err) {
        console.error('Auto-save 실패:', err);
      }
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeTab?.content, autoSave, autoSaveDelay]);

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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
          title="사이드바 토글 (Ctrl+\)"
        >
          {sidebarVisible ? '◀' : '▶'}
        </button>
        
        <div 
          className={`editor-wrapper-layout ${!wordWrap ? 'word-wrap-disabled' : ''}${isDragOver ? ' drag-over' : ''}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
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
          {activeTab ? (
            <MarkdownEditor
              key={activeTab.id}
              content={activeTab.content}
              onChange={handleEditorChange}
            />
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              파일을 열거나 새 파일을 만드세요 (Ctrl+N / Ctrl+O / 설정: Ctrl+,)
            </div>
          )}
        </div>
      </div>
      <StatusBar onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
};

export default App;

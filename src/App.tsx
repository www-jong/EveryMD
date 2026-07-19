import React, { useState, useEffect } from 'react';
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
import { readFile } from './utils/fileSystem';

const App: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const toggleSidebar = () => setSidebarVisible((v) => !v);

  useKeyboard({ onToggleSidebar: toggleSidebar });
  useTheme();
  
  const activeTab = useFileStore((state) => state.getActiveTab());
  const openFile = useFileStore((state) => state.openFile);
  const updateContent = useFileStore((state) => state.updateContent);
  const { isSettingsOpen, setSettingsOpen, wordWrap } = useSettingsStore();

  // URL 쿼리 파라미터 감지하여 새 창 독립 실행 시 지정된 파일 자동 오픈
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openFilePath = params.get('openFile');
    if (openFilePath) {
      // 쿼리에 오픈할 파일명이 전달된 경우 즉시 읽어서 탭에 마운트
      const fileName = openFilePath.substring(openFilePath.lastIndexOf(openFilePath.includes('/') ? '/' : '\\') + 1);
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

  const handleEditorChange = (markdown: string) => {
    if (activeTab) {
      updateContent(activeTab.id, markdown);
    }
  };

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
          title="사이드바 토글 (Ctrl+B)"
        >
          {sidebarVisible ? '◀' : '▶'}
        </button>
        
        <div 
          className={`editor-wrapper-layout ${!wordWrap ? 'word-wrap-disabled' : ''}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
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

import React, { useState } from 'react';
import { TitleBar } from './components/TitleBar/TitleBar';
import { TabBar } from './components/TabBar/TabBar';
import { FileExplorer } from './components/Sidebar/FileExplorer';
import { MarkdownEditor } from './components/Editor/MarkdownEditor';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useKeyboard } from './hooks/useKeyboard';
import { useTheme } from './hooks/useTheme';
import { useFileStore } from './stores/fileStore';

const App: React.FC = () => {
  useKeyboard();
  useTheme(); // Initializes theme attribute on mount
  
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const activeTab = useFileStore((state) => state.getActiveTab());
  const updateContent = useFileStore((state) => state.updateContent);

  const toggleSidebar = () => setSidebarVisible((v) => !v);

  const handleEditorChange = (markdown: string) => {
    if (activeTab) {
      updateContent(activeTab.id, markdown);
    }
  };

  return (
    <>
      <TitleBar />
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
          }}
          title="사이드바 토글 (Ctrl+B)"
        >
          {sidebarVisible ? '◀' : '▶'}
        </button>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab ? (
            <MarkdownEditor
              key={activeTab.id} // Important: force remount when switching tabs to reset Milkdown
              content={activeTab.content}
              onChange={handleEditorChange}
            />
          ) : (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              파일을 열거나 새 파일을 만드세요 (Ctrl+N / Ctrl+O)
            </div>
          )}
        </div>
      </div>
      <StatusBar />
    </>
  );
};

export default App;

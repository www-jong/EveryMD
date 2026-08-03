import React, { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openFolderDialog, readDirectory, readFile, renameFile, duplicateFile, isTauri } from '../../utils/fileSystem';
import { useFileStore } from '../../stores/fileStore';
import { FileEntry } from '../../types';
import './FileExplorer.css';

// Tauri 2.x 새 웹뷰 창 열기 클래스 동적 로드
let WebviewWindow: any = null;
if (isTauri()) {
  import('@tauri-apps/api/webviewWindow').then((mod) => {
    WebviewWindow = mod.WebviewWindow;
  }).catch(console.error);
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  entry: FileEntry | null;
}

const FileTreeItem: React.FC<{ 
  entry: FileEntry; 
  onFileClick: (entry: FileEntry) => void;
  refreshTrigger: number;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
}> = ({ entry, onFileClick, refreshTrigger, onContextMenu }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);

  const loadDirectory = useCallback(async () => {
    if (entry.isDir) {
      try {
        const entries = await readDirectory(entry.path);
        setChildren(entries);
      } catch (err) {
        console.error('Failed to read sub-directory:', err);
      }
    }
  }, [entry.path, entry.isDir]);

  useEffect(() => {
    if (isOpen) {
      loadDirectory();
    }
  }, [isOpen, refreshTrigger, loadDirectory]);

  const handleClick = async () => {
    if (entry.isDir) {
      if (!isOpen && children.length === 0) {
        await loadDirectory();
      }
      setIsOpen(!isOpen);
    } else {
      onFileClick(entry);
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, entry);
  };

  return (
    <div className="file-tree-item">
      <div 
        className="file-tree-row" 
        onClick={handleClick}
        onContextMenu={handleRowContextMenu}
      >
        <span className="file-icon">{entry.isDir ? '📁' : '📄'}</span>
        <span className="file-name">{entry.name}</span>
      </div>
      {entry.isDir && isOpen && (
        <div className="file-tree-children">
          {children.map((child) => (
            <FileTreeItem 
              key={child.path} 
              entry={child} 
              onFileClick={onFileClick} 
              refreshTrigger={refreshTrigger}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC = () => {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    entry: null,
  });

  const openFile = useFileStore((state) => state.openFile);
  const openFolderPath = useFileStore((state) => state.openFolderPath);
  const setOpenFolderPath = useFileStore((state) => state.setOpenFolderPath);
  const refreshTrigger = useFileStore((state) => state.refreshTrigger);
  const triggerRefresh = useFileStore((state) => state.triggerRefresh);

  const loadRoot = useCallback(async () => {
    if (openFolderPath) {
      try {
        const entries = await readDirectory(openFolderPath);
        setRootEntries(entries);
      } catch (err) {
        console.error('Failed to read root directory:', err);
      }
    }
  }, [openFolderPath]);

  useEffect(() => {
    loadRoot();
  }, [openFolderPath, refreshTrigger, loadRoot]);

  // 창 포커스 / 탭 전환 시 파일 목록 자동 갱신 (폴링 없이 이벤트 기반)
  useEffect(() => {
    if (!openFolderPath) return;

    const handleFocus = () => {
      triggerRefresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [openFolderPath, triggerRefresh]);

  // 바깥 배경 클릭 시 우클릭 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleCloseMenu = () => {
      setContextMenu((prev) => prev.visible ? { ...prev, visible: false } : prev);
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleOpenFolder = async () => {
    const path = await openFolderDialog();
    if (path) {
      setOpenFolderPath(path);
    }
  };

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
      try {
        const content = await readFile(entry.path);
        openFile(entry.path, content, entry.name);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  }, [openFile]);

  // 컨텍스트 메뉴 활성화 핸들러
  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      entry: entry,
    });
  };

  // 컨텍스트 기능 1: 이름 변경 (Rename)
  const handleRename = async () => {
    const entry = contextMenu.entry;
    if (!entry) return;

    const newName = prompt('새로운 파일/폴더명을 입력하세요:', entry.name);
    if (!newName || newName.trim() === '' || newName === entry.name) return;

    try {
      const parentPath = entry.path.substring(0, entry.path.lastIndexOf(entry.path.includes('/') ? '/' : '\\'));
      const sep = entry.path.includes('/') ? '/' : '\\';
      const newPath = parentPath + sep + newName.trim();
      
      await renameFile(entry.path, newPath);
      // 파일 시스템 처리 완료 후 즉각 갱신
      setTimeout(() => triggerRefresh(), 80);
    } catch (err) {
      console.error('이름 변경 실패:', err);
      alert('이름을 변경할 수 없습니다.');
    }
  };

  // 컨텍스트 기능 2: 복제 (Duplicate)
  const handleDuplicate = async () => {
    const entry = contextMenu.entry;
    if (!entry || entry.isDir) return;

    try {
      await duplicateFile(entry.path);
      triggerRefresh();
    } catch (err) {
      console.error('복제 실패:', err);
      alert('파일을 복제할 수 없습니다.');
    }
  };

  // 컨텍스트 기능 3: 절대 경로 복사
  const handleCopyPath = async () => {
    const entry = contextMenu.entry;
    if (!entry) return;

    try {
      await navigator.clipboard.writeText(entry.path);
    } catch (err) {
      console.error('경로 복사 실패:', err);
    }
  };

  // 컨텍스트 기능 4: 파일 탐색기에서 열기 (해당 파일/폴더를 선택한 채로 탐색기 오픈)
  const handleRevealInExplorer = async () => {
    const entry = contextMenu.entry;
    if (!entry) return;

    if (!isTauri()) {
      alert('데스크톱 환경(Tauri)에서만 탐색기 열기를 지원합니다.');
      return;
    }

    try {
      await invoke('plugin:opener|reveal_item_in_dir', { path: entry.path });
    } catch (err) {
      console.error('탐색기 열기 실패:', err);
      alert('탐색기에서 열기에 실패했습니다.');
    }
  };
  const handleOpenInNewWindow = () => {
    const entry = contextMenu.entry;
    if (!entry || entry.isDir) return;

    if (!isTauri() || !WebviewWindow) {
      alert('데스크톱 환경(Tauri)에서만 새 창 열기를 지원합니다.');
      return;
    }

    try {
      const windowId = 'everymd_window_' + Date.now();
      const newWindow = new WebviewWindow(windowId, {
        title: `${entry.name} - EveryMD`,
        url: `index.html?openFile=${encodeURIComponent(entry.path)}`,
        width: 1000,
        height: 700,
        decorations: false, // 새 윈도우도 일관되게 창 테두리를 비활성화하여 커스텀 상단바 작동 보장
      });

      newWindow.once('tauri://created', () => {
        console.log('새 윈도우 생성 완료:', windowId);
      });
      newWindow.once('tauri://error', (e: any) => {
        console.error('새 윈도우 생성 에러:', e);
      });
    } catch (err) {
      console.error('새 창 생성 실패:', err);
    }
  };

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span>탐색기</span>
        <div className="header-actions">
          <button 
            className="header-btn" 
            onClick={handleOpenFolder} 
            title="폴더 열기"
          >
            폴더 열기
          </button>
        </div>
      </div>
      <div className="file-explorer-content">
        {rootEntries.length === 0 ? (
          <div className="empty-message">폴더를 열어주세요</div>
        ) : (
          rootEntries.map((entry) => (
            <FileTreeItem 
              key={entry.path} 
              entry={entry} 
              onFileClick={handleFileClick} 
              refreshTrigger={refreshTrigger}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* 우클릭 컨텍스트 메뉴 레이어 */}
      {contextMenu.visible && (
        <div 
          className="explorer-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={handleRename}>
            <span>이름 수정 (Rename)...</span>
          </div>
          <div className="context-menu-item" onClick={handleRevealInExplorer}>
            <span>📂 탐색기에서 열기</span>
          </div>
          {contextMenu.entry && !contextMenu.entry.isDir && (
            <>
              <div className="context-menu-item" onClick={handleOpenInNewWindow}>
                <span>새 윈도우에서 열기</span>
              </div>
              <div className="context-menu-item" onClick={handleDuplicate}>
                <span>복제 (Duplicate)</span>
              </div>
            </>
          )}
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={handleCopyPath}>
            <span>경로 복사 (Copy Path)</span>
          </div>
        </div>
      )}
    </div>
  );
};

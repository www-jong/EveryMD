import React, { useState, useCallback, useEffect } from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { openFolderDialog, readDirectory, readFile, writeFile, renameFile, duplicateFile, isTauri, SUPPORTED_EXTENSIONS } from '../../utils/fileSystem';
import { useFileStore } from '../../stores/fileStore';
import { FileEntry } from '../../types';
import { FolderChangeModal } from '../Modal/FolderChangeModal';
import { RenameModal } from '../Modal/RenameModal';
import './FileExplorer.css';

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

  const isSupported = entry.isDir || SUPPORTED_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith('.' + ext));

  const handleClick = async () => {
    if (entry.isDir) {
      if (!isOpen && children.length === 0) {
        await loadDirectory();
      }
      setIsOpen(!isOpen);
    } else if (isSupported) {
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
        className={`file-tree-row ${!isSupported ? 'unsupported' : ''}`} 
        onClick={handleClick}
        onContextMenu={handleRowContextMenu}
        title={!isSupported ? `${entry.name} (지원되지 않는 파일 형식)` : entry.name}
      >
        <span className="file-icon">{entry.isDir ? '📁' : isSupported ? '📄' : '📎'}</span>
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

  const [pendingFolderPath, setPendingFolderPath] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [renameModalState, setRenameModalState] = useState<{
    isOpen: boolean;
    entry: FileEntry | null;
  }>({
    isOpen: false,
    entry: null,
  });

  const tabs = useFileStore((state) => state.tabs);
  const openFile = useFileStore((state) => state.openFile);
  const openFolderPath = useFileStore((state) => state.openFolderPath);
  const setOpenFolderPath = useFileStore((state) => state.setOpenFolderPath);
  const closeAllTabs = useFileStore((state) => state.closeAllTabs);
  const refreshTrigger = useFileStore((state) => state.refreshTrigger);
  const triggerRefresh = useFileStore((state) => state.triggerRefresh);
  const retargetTabPath = useFileStore((state) => state.retargetTabPath);

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
    if (!path) return;

    // 현재 열려 있는 탭이 1개 이상이고, 다른 폴더를 열려고 하는 경우 모달 표시
    if (tabs.length > 0 && path !== openFolderPath) {
      setPendingFolderPath(path);
      setIsFolderModalOpen(true);
    } else {
      setOpenFolderPath(path);
    }
  };

  const handleCloseAndOpenFolder = () => {
    if (pendingFolderPath) {
      closeAllTabs();
      setOpenFolderPath(pendingFolderPath);
    }
    setIsFolderModalOpen(false);
    setPendingFolderPath(null);
  };

  const handleKeepAndOpenFolder = () => {
    if (pendingFolderPath) {
      setOpenFolderPath(pendingFolderPath);
    }
    setIsFolderModalOpen(false);
    setPendingFolderPath(null);
  };

  const handleCancelFolderChange = () => {
    setIsFolderModalOpen(false);
    setPendingFolderPath(null);
  };

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    if (SUPPORTED_EXTENSIONS.some((ext) => entry.name.toLowerCase().endsWith('.' + ext))) {
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

  // 컨텍스트 기능 1: 이름 변경 모달 열기
  const handleRenameClick = () => {
    const entry = contextMenu.entry;
    if (!entry) return;
    setContextMenu((prev) => ({ ...prev, visible: false }));
    setRenameModalState({
      isOpen: true,
      entry,
    });
  };

  // 이름 변경 확정 처리
  const handleConfirmRename = async (newName: string) => {
    const entry = renameModalState.entry;
    if (!entry) return;

    setRenameModalState({ isOpen: false, entry: null });

    try {
      const sep = entry.path.includes('/') ? '/' : '\\';
      const lastSepIndex = entry.path.lastIndexOf(sep);
      const newPath = lastSepIndex < 0 
        ? newName 
        : lastSepIndex === 0 
          ? `${sep}${newName}` 
          : `${entry.path.substring(0, lastSepIndex)}${sep}${newName}`;
      
      // 열려 있는 탭 중 이 파일이 있고 미저장 편집 내용이 있다면 먼저 디스크에 저장
      const openTab = tabs.find((t) => t.filePath === entry.path);
      if (openTab && openTab.isDirty) {
        await writeFile(entry.path, openTab.content);
      }

      await renameFile(entry.path, newPath);
      // 열려 있는 탭의 경로/제목 동기화
      retargetTabPath(entry.path, newPath);
      // 탐색기 트리 즉각 갱신
      triggerRefresh();
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
      await revealItemInDir(entry.path);
    } catch (err) {
      console.error('탐색기 열기 실패:', err);
      alert('탐색기에서 열기에 실패했습니다.');
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
          <div className="context-menu-item" onClick={handleRenameClick}>
            <span>📝 이름 변경 (Rename)...</span>
          </div>
          <div className="context-menu-item" onClick={handleRevealInExplorer}>
            <span>📂 탐색기에서 열기</span>
          </div>
          {contextMenu.entry && !contextMenu.entry.isDir && (
            <div className="context-menu-item" onClick={handleDuplicate}>
              <span>📄 복제 (Duplicate)</span>
            </div>
          )}
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={handleCopyPath}>
            <span>📋 경로 복사 (Copy Path)</span>
          </div>
        </div>
      )}

      {/* 파일/폴더 이름 변경 모달 */}
      <RenameModal
        isOpen={renameModalState.isOpen}
        currentName={renameModalState.entry?.name || ''}
        isDir={renameModalState.entry?.isDir}
        onConfirm={handleConfirmRename}
        onCancel={() => setRenameModalState({ isOpen: false, entry: null })}
      />

      {/* 작업 폴더 변경 시 탭 처리 확인 모달 */}
      <FolderChangeModal
        isOpen={isFolderModalOpen}
        pendingFolderPath={pendingFolderPath}
        tabCount={tabs.length}
        onCloseAndOpen={handleCloseAndOpenFolder}
        onKeepAndOpen={handleKeepAndOpenFolder}
        onCancel={handleCancelFolderChange}
      />
    </div>
  );
};

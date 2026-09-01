import React, { useState, useEffect, useRef } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useFileSystem } from '../../hooks/useFileSystem';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import './TabBar.css';

export const TabBar: React.FC = () => {
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const setActiveTabId = useFileStore((state) => state.setActiveTabId);
  const newFile = useFileStore((state) => state.newFile);
  const closeOtherTabs = useFileStore((state) => state.closeOtherTabs);
  const { handleCloseTab, handleRename } = useFileSystem();

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu?.visible) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [contextMenu]);

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    const MENU_WIDTH = 180;
    const MENU_HEIGHT = 130;
    const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8);
    const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8);
    setContextMenu({
      visible: true,
      x,
      y,
      tabId,
    });
  };

  const onRenameClick = () => {
    if (contextMenu) {
      handleRename(contextMenu.tabId);
      setContextMenu(null);
    }
  };

  const onShowInExplorerClick = async () => {
    if (contextMenu) {
      const tab = tabs.find((t) => t.id === contextMenu.tabId);
      if (tab?.filePath) {
        try {
          await revealItemInDir(tab.filePath);
        } catch (err) {
          console.error('Failed to open file in explorer:', err);
        }
      } else {
        alert('아직 디스크에 저장되지 않은 파일입니다.');
      }
      setContextMenu(null);
    }
  };

  const onCloseOthersClick = () => {
    if (contextMenu) {
      closeOtherTabs(contextMenu.tabId);
      setContextMenu(null);
    }
  };

  return (
    <div className="tabbar">
      <div className="tabs-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.isDeletedFromDisk ? 'is-deleted' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
            onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
            title={tab.isDeletedFromDisk ? '디스크에서 삭제된 파일입니다. (Ctrl+S로 다시 저장 가능)' : '우클릭하여 메뉴 보기'}
          >
            <span className={`tab-title ${tab.isDeletedFromDisk ? 'deleted' : ''}`}>
              {tab.title}
              {tab.isDeletedFromDisk && <span className="tab-deleted-tag">삭제됨</span>}
            </span>
            {tab.isDirty && <span className="tab-dirty">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-new" onClick={newFile} title="새 파일 (Ctrl+N)">
        +
      </button>

      {/* 우클릭 커스텀 컨텍스트 메뉴 */}
      {contextMenu?.visible && (
        <div
          ref={menuRef}
          className="tab-context-menu"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
        >
          <div className="menu-item" onClick={onRenameClick}>
            📝 이름 변경 (Rename)
          </div>
          <div className="menu-item" onClick={onShowInExplorerClick}>
            📂 폴더에서 열기
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => { handleCloseTab(contextMenu.tabId); setContextMenu(null); }}>
            ❌ 탭 닫기
          </div>
          <div className="menu-item" onClick={onCloseOthersClick}>
            🚫 다른 탭 모두 닫기
          </div>
        </div>
      )}
    </div>
  );
};

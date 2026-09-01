import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useFileSystem } from '../../hooks/useFileSystem';
import { formatShortcut } from '../../utils/shortcut';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import './TabBar.css';

export const TabBar: React.FC = () => {
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const setActiveTabId = useFileStore((state) => state.setActiveTabId);
  const newFile = useFileStore((state) => state.newFile);
  const closeOtherTabs = useFileStore((state) => state.closeOtherTabs);
  const { handleCloseTab, handleRename } = useFileSystem();

  // 탭 컨테이너 참조 및 활성 탭 참조
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeTabElementRef = useRef<HTMLDivElement | null>(null);

  // 탭 목록 전체보기 드롭다운 상태
  const [isTabListOpen, setIsTabListOpen] = useState(false);
  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const tabListRef = useRef<HTMLDivElement | null>(null);

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // ─── 1. 활성 탭 자동 시야 확보 (Auto Scroll-Into-View) ────────────────────────
  useEffect(() => {
    if (activeTabElementRef.current) {
      activeTabElementRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest'
      });
    }
  }, [activeTabId]);

  // ─── 2. 마우스 휠 가로 스크롤 변환 ──────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (tabsContainerRef.current) {
      // 휠을 굴리면 상하 대신 가로로 자연스럽게 스크롤
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // 외부 클릭 시 드롭다운 및 컨텍스트 메뉴 닫기
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (tabListRef.current && !tabListRef.current.contains(e.target as Node)) {
        setIsTabListOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

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

  const filteredTabs = tabs.filter(t => 
    t.title.toLowerCase().includes(tabSearchQuery.toLowerCase()) ||
    (t.filePath && t.filePath.toLowerCase().includes(tabSearchQuery.toLowerCase()))
  );

  return (
    <div className="tabbar">
      <div 
        className="tabs-container" 
        ref={tabsContainerRef}
        onWheel={handleWheel}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              ref={isActive ? activeTabElementRef : null}
              className={`tab ${isActive ? 'active' : ''} ${tab.isDeletedFromDisk ? 'is-deleted' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleTabContextMenu(e, tab.id)}
              title={tab.filePath || tab.title}
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
                title="탭 닫기"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="tabbar-controls">
        {/* 새 탭 버튼 */}
        <button 
          className="tab-new-btn" 
          onClick={newFile} 
          title={`새 문서 (${formatShortcut('ctrl+n')})`}
        >
          +
        </button>

        {/* 탭 목록 전체보기 드롭다운 버튼 */}
        <div className="tab-list-wrapper" ref={tabListRef}>
          <button
            className={`tab-list-toggle-btn ${isTabListOpen ? 'active' : ''}`}
            onClick={() => {
              setIsTabListOpen(!isTabListOpen);
              setTabSearchQuery('');
            }}
            title={`열린 탭 목록 (${tabs.length}개)`}
          >
            <span className="tab-list-icon">▾</span>
            <span className="tab-list-count">{tabs.length}</span>
          </button>

          {isTabListOpen && (
            <div className="tab-list-dropdown">
              <div className="tab-list-dropdown-header">
                <input
                  type="text"
                  autoFocus
                  placeholder="열린 탭 검색..."
                  value={tabSearchQuery}
                  onChange={(e) => setTabSearchQuery(e.target.value)}
                  className="tab-list-search-input"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="tab-list-dropdown-body">
                {filteredTabs.length === 0 ? (
                  <div className="tab-list-empty">검색 결과가 없습니다.</div>
                ) : (
                  filteredTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className={`tab-list-dropdown-item ${tab.id === activeTabId ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTabId(tab.id);
                        setIsTabListOpen(false);
                      }}
                    >
                      <div className="dropdown-item-left">
                        <span className="dropdown-item-indicator">
                          {tab.id === activeTabId ? '✓' : ''}
                        </span>
                        <div className="dropdown-item-text">
                          <span className="dropdown-item-title">{tab.title}</span>
                          {tab.filePath && (
                            <span className="dropdown-item-path">{tab.filePath}</span>
                          )}
                        </div>
                      </div>
                      <div className="dropdown-item-right">
                        {tab.isDirty && <span className="dropdown-item-dirty">●</span>}
                        <button
                          className="dropdown-item-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          title="탭 닫기"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { Tab } from '../../types';
import { formatShortcut } from '../../utils/shortcut';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { writeFile, renameFile } from '../../utils/fileSystem';
import { RenameModal } from '../Modal/RenameModal';
import { UnsavedFilesModal } from '../Modal/UnsavedFilesModal';
import './TabBar.css';

export const TabBar: React.FC = () => {
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const setActiveTabId = useFileStore((state) => state.setActiveTabId);
  const newFile = useFileStore((state) => state.newFile);
  const closeTab = useFileStore((state) => state.closeTab);
  const closeOtherTabs = useFileStore((state) => state.closeOtherTabs);
  const renameTabTitle = useFileStore((state) => state.renameTabTitle);
  const retargetTabPath = useFileStore((state) => state.retargetTabPath);
  const triggerRefresh = useFileStore((state) => state.triggerRefresh);

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

  // 미저장 변경사항 닫기 확인 모달 상태
  const [pendingUnsavedClose, setPendingUnsavedClose] = useState<{
    dirtyTabs: Tab[];
    onConfirm: () => void;
  } | null>(null);

  // 이름 변경 모달 상태
  const [renameModalState, setRenameModalState] = useState<{
    isOpen: boolean;
    tabId: string;
    currentName: string;
  }>({
    isOpen: false,
    tabId: '',
    currentName: '',
  });

  // ─── 1. 활성 탭 자동 시야 확보 (Auto Scroll-Into-View) ────────────────────────
  useEffect(() => {
    if (activeTabElementRef.current) {
      activeTabElementRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest',
      });
    }
  }, [activeTabId]);

  // ─── 2. 마우스 휠 가로 스크롤 변환 ──────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (tabsContainerRef.current) {
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

  // 탭 더블클릭 시 이름 변경 모달 오픈
  const handleTabDoubleClick = (tabId: string, title: string) => {
    setContextMenu(null);
    setRenameModalState({
      isOpen: true,
      tabId,
      currentName: title,
    });
  };

  // 탭 우클릭 핸들러
  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    const MENU_WIDTH = 190;
    const MENU_HEIGHT = 220;
    const x = Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8);
    const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8);
    setContextMenu({
      visible: true,
      x,
      y,
      tabId,
    });
  };

  // 컨텍스트 메뉴: 이름 변경
  const onRenameClick = () => {
    if (contextMenu) {
      const tab = tabs.find((t) => t.id === contextMenu.tabId);
      if (tab) {
        setRenameModalState({
          isOpen: true,
          tabId: tab.id,
          currentName: tab.title,
        });
      }
      setContextMenu(null);
    }
  };

  // 컨텍스트 메뉴: 탐색기에서 열기
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

  // 컨텍스트 메뉴: 경로 복사
  const onCopyPathClick = async () => {
    if (contextMenu) {
      const tab = tabs.find((t) => t.id === contextMenu.tabId);
      if (tab?.filePath) {
        try {
          await navigator.clipboard.writeText(tab.filePath);
        } catch (err) {
          console.error('경로 복사 실패:', err);
        }
      } else {
        alert('아직 디스크에 저장되지 않은 파일입니다.');
      }
      setContextMenu(null);
    }
  };

  // 탭 닫기 요청 (미저장 파일인 경우 확인 모달 연동)
  const handleCloseTabRequest = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.isDirty) {
      setPendingUnsavedClose({
        dirtyTabs: [tab],
        onConfirm: () => closeTab(tab.id),
      });
    } else {
      closeTab(tab.id);
    }
  };

  // 컨텍스트 메뉴: 다른 탭 모두 닫기
  const onCloseOthersClick = () => {
    if (contextMenu) {
      const targetId = contextMenu.tabId;
      const otherDirtyTabs = tabs.filter((t) => t.id !== targetId && t.isDirty);
      if (otherDirtyTabs.length > 0) {
        setPendingUnsavedClose({
          dirtyTabs: otherDirtyTabs,
          onConfirm: () => closeOtherTabs(targetId),
        });
      } else {
        closeOtherTabs(targetId);
      }
      setContextMenu(null);
    }
  };

  // 이름 변경 확정 핸들러
  const handleConfirmRename = async (newName: string) => {
    const { tabId } = renameModalState;
    const tab = tabs.find((t) => t.id === tabId);
    setRenameModalState({ isOpen: false, tabId: '', currentName: '' });
    if (!tab) return;

    const trimmed = newName.trim();
    if (!trimmed || trimmed === tab.title) return;

    try {
      if (tab.filePath) {
        const sep = tab.filePath.includes('/') ? '/' : '\\';
        const lastSepIndex = tab.filePath.lastIndexOf(sep);
        const newPath = lastSepIndex < 0 
          ? trimmed 
          : lastSepIndex === 0 
            ? `${sep}${trimmed}` 
            : `${tab.filePath.substring(0, lastSepIndex)}${sep}${trimmed}`;

        // 미저장 내용이 있다면 먼저 디스크 저장
        if (tab.isDirty) {
          await writeFile(tab.filePath, tab.content);
        }

        await renameFile(tab.filePath, newPath);
        retargetTabPath(tab.filePath, newPath);
        renameTabTitle(tab.id, trimmed);
        triggerRefresh();
      } else {
        renameTabTitle(tab.id, trimmed);
      }
    } catch (err) {
      console.error('이름 변경 실패:', err);
      alert('파일 이름을 변경할 수 없습니다.');
    }
  };

  const filteredTabs = tabs.filter((t) =>
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
              <span 
                className={`tab-title ${tab.isDeletedFromDisk ? 'deleted' : ''}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleTabDoubleClick(tab.id, tab.title);
                }}
                title="더블클릭하여 파일명 수정"
              >
                {tab.title}
                {tab.isDeletedFromDisk && <span className="tab-deleted-tag">삭제됨</span>}
              </span>
              {tab.isDirty && <span className="tab-dirty">●</span>}
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTabRequest(tab.id);
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
                            handleCloseTabRequest(tab.id);
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

      {/* 우클릭 커스텀 컨텍스트 메뉴 (탐색기와 완전히 동일한 양식 및 스타일) */}
      {contextMenu?.visible && (
        <div
          ref={menuRef}
          className="explorer-context-menu"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={onRenameClick}>
            <span>📝 이름 변경 (Rename)...</span>
          </div>
          <div className="context-menu-item" onClick={onShowInExplorerClick}>
            <span>📂 탐색기에서 열기</span>
          </div>
          <div className="context-menu-item" onClick={onCopyPathClick}>
            <span>📋 경로 복사 (Copy Path)</span>
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { handleCloseTabRequest(contextMenu.tabId); setContextMenu(null); }}>
            <span>❌ 탭 닫기</span>
          </div>
          <div className="context-menu-item" onClick={onCloseOthersClick}>
            <span>🚫 다른 탭 모두 닫기</span>
          </div>
        </div>
      )}

      {/* 미저장 변경사항 닫기 확인 모달 */}
      {pendingUnsavedClose && (
        <UnsavedFilesModal
          dirtyTabs={pendingUnsavedClose.dirtyTabs}
          onConfirmClose={() => {
            if (pendingUnsavedClose) {
              pendingUnsavedClose.onConfirm();
              setPendingUnsavedClose(null);
            }
          }}
          onCancel={() => {
            setPendingUnsavedClose(null);
          }}
        />
      )}

      {/* 파일명 변경 모달 */}
      <RenameModal
        isOpen={renameModalState.isOpen}
        currentName={renameModalState.currentName}
        onConfirm={handleConfirmRename}
        onCancel={() => setRenameModalState({ isOpen: false, tabId: '', currentName: '' })}
      />
    </div>
  );
};


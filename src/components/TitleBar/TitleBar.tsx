import React, { useCallback, useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useFileStore } from '../../stores/fileStore';
import { isMacOS } from '../../utils/platform';
import './TitleBar.css';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = isMacOS();

  // 현재 활성 탭 제목 구독
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // 최대화 상태 업데이트 헬퍼
  const checkMaximizeState = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      setIsMaximized(maximized);
    } catch (e) {
      console.error('최대화 상태 조회 실패:', e);
    }
  }, []);

  useEffect(() => {
    // 최초 상태 체크
    checkMaximizeState();

    // Tauri 2.x 리스너 구독 해제 함수 리스트
    const unlistenActions: Array<() => void> = [];

    const setupListeners = async () => {
      try {
        const win = getCurrentWindow();

        // 1. 최대화 이벤트 구독
        const unsubMaximized = await win.listen('tauri://maximized', () => {
          setIsMaximized(true);
        });
        unlistenActions.push(unsubMaximized);

        // 2. 최대화 해제 이벤트 구독
        const unsubUnmaximized = await win.listen('tauri://unmaximized', () => {
          setIsMaximized(false);
        });
        unlistenActions.push(unsubUnmaximized);

        // 3. 리사이즈 이벤트 구독
        const unsubResized = await win.listen('tauri://resize', () => {
          checkMaximizeState();
        });
        unlistenActions.push(unsubResized);
      } catch (e) {
        console.error('Tauri 창 이벤트 리스너 등록 중 오류:', e);
      }
    };

    setupListeners();

    // 컴포넌트 소멸 시 등록했던 모든 리스너 제거
    return () => {
      unlistenActions.forEach((unsub) => unsub());
    };
  }, [checkMaximizeState]);

  const handleMinimize = useCallback(async () => {
    try { 
      await getCurrentWindow().minimize(); 
    } catch (e) { 
      console.error('최소화 실패:', e); 
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      if (maximized) {
        await win.unmaximize();
      } else {
        await win.maximize();
      }
      setTimeout(async () => {
        const realState = await win.isMaximized();
        setIsMaximized(realState);
      }, 50);
    } catch (e) {
      console.error('최대화 토글 실패:', e);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try { 
      await getCurrentWindow().close(); 
    } catch (e) { 
      console.error('닫기 실패:', e); 
    }
  }, []);

  return (
    <div className={`titlebar ${isMaximized ? 'maximized' : ''} ${isMac ? 'is-mac' : ''}`} data-tauri-drag-region>
      {/* 타이틀바의 좌측 부분만 드래그 가능 영역으로 설정 */}
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-title" data-tauri-drag-region>EveryMD</span>
        {activeTab && (
          <span className="titlebar-filename" data-tauri-drag-region>
            {activeTab.isDirty ? '● ' : '— '}{activeTab.title}
          </span>
        )}
      </div>

      {/* Windows 전용 창 제어 버튼 */}
      {!isMac && (
        <div className="titlebar-right">
          {/* 최소화 */}
          <div className="titlebar-button" onClick={handleMinimize} title="최소화">
            <svg viewBox="0 0 10 1" width="10" height="1">
              <rect width="10" height="1" fill="currentColor"/>
            </svg>
          </div>

          {/* 최대화/창 복원 */}
          <div className="titlebar-button" onClick={handleMaximize} title={isMaximized ? '이전 크기로 복원' : '최대화'}>
            {isMaximized ? (
              <svg viewBox="0 0 10 10" width="10" height="10">
                <path d="M3,1 L9,1 L9,7 L8,7 L8,8 L2,8 L2,2 L3,2 Z" fill="none" stroke="currentColor" strokeWidth="1"/>
                <rect x="1" y="3" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" width="10" height="10">
                <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
            )}
          </div>

          {/* 닫기 */}
          <div className="titlebar-button close" onClick={handleClose} title="닫기">
            <svg viewBox="0 0 10 10" width="10" height="10">
              <path d="M 0 0 L 10 10 M 10 0 L 0 10" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

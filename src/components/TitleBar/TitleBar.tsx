import React, { useCallback, useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './TitleBar.css';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // 최대화 상태 업데이트 헬퍼
  const updateMaximizeState = useCallback(async () => {
    try {
      const maximized = await getCurrentWindow().isMaximized();
      setIsMaximized(maximized);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    // 최초 상태 체크
    updateMaximizeState();

    // 윈도우 크기 변경 시 최대화 상태 실시간 갱신 리스너 등록 (Tauri 2.x API)
    let unlisten: (() => void) | null = null;
    getCurrentWindow().onResized(() => {
      updateMaximizeState();
    }).then((unsub) => {
      unlisten = unsub;
    }).catch(console.error);

    return () => {
      if (unlisten) unlisten();
    };
  }, [updateMaximizeState]);

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
      setIsMaximized(!maximized);
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
    <div className={`titlebar ${isMaximized ? 'maximized' : ''}`}>
      {/* 
        부모 .titlebar에서 data-tauri-drag-region을 제외하여 
        우측 버튼들의 클릭이 하이재킹되는 문제를 완벽 해결하고, 
        오직 좌측 영역을 통해서만 창을 드래그하여 이동할 수 있게 합니다.
      */}
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-title" data-tauri-drag-region>EveryMD</span>
      </div>
      <div className="titlebar-right">
        {/* 최소화 */}
        <div className="titlebar-button" onClick={handleMinimize} title="최소화">
          <svg viewBox="0 0 10 1" width="10" height="1">
            <rect width="10" height="1" fill="currentColor"/>
          </svg>
        </div>

        {/* 최대화/창 복원 (전체화면 상태에 따라 다른 최적화 아이콘 제공) */}
        <div className="titlebar-button" onClick={handleMaximize} title={isMaximized ? '이전 크기로 복원' : '최대화'}>
          {isMaximized ? (
            // 창 복원 아이콘 (겹친 사각형)
            <svg viewBox="0 0 10 10" width="10" height="10">
              <path d="M3,1 L9,1 L9,7 L8,7 L8,8 L2,8 L2,2 L3,2 Z" fill="none" stroke="currentColor" strokeWidth="1"/>
              <rect x="1" y="3" width="6" height="6" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          ) : (
            // 최대화 아이콘 (단일 사각형)
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
    </div>
  );
};

import React, { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './TitleBar.css';

export const TitleBar: React.FC = () => {
  const handleMinimize = useCallback(async () => {
    try { await getCurrentWindow().minimize(); } catch (e) { console.error(e); }
  }, []);

  const handleMaximize = useCallback(async () => {
    try { await getCurrentWindow().toggleMaximize(); } catch (e) { console.error(e); }
  }, []);

  const handleClose = useCallback(async () => {
    try { await getCurrentWindow().close(); } catch (e) { console.error(e); }
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        <span className="titlebar-title">EveryMD</span>
      </div>
      <div className="titlebar-right">
        <div className="titlebar-button" onClick={handleMinimize}>
          <svg viewBox="0 0 10 1" width="10" height="1"><rect width="10" height="1" fill="currentColor"/></svg>
        </div>
        <div className="titlebar-button" onClick={handleMaximize}>
          <svg viewBox="0 0 10 10" width="10" height="10"><rect width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
        </div>
        <div className="titlebar-button close" onClick={handleClose}>
          <svg viewBox="0 0 10 10" width="10" height="10">
            <path d="M 0 0 L 10 10 M 10 0 L 0 10" fill="none" stroke="currentColor" strokeWidth="1"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

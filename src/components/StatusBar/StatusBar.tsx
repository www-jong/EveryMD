import React from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import './StatusBar.css';

interface StatusBarProps {
  onOpenSettings: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ onOpenSettings }) => {
  const activeTab = useFileStore((state) => state.getActiveTab());
  const { theme, toggleTheme } = useTheme();
  const fontSize = useSettingsStore((state) => state.fontSize);

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        {activeTab ? (activeTab.filePath || '저장되지 않음') : '준비'}
      </div>
      <div className="statusbar-center">
        Ln 1, Col 1
      </div>
      <div className="statusbar-right">
        <span className="statusbar-item">글꼴: {fontSize}px</span>
        <button className="statusbar-btn" onClick={toggleTheme} title="테마 변경">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="statusbar-btn" onClick={onOpenSettings} title="설정 (Ctrl+,)">
          ⚙️
        </button>
      </div>
    </div>
  );
};

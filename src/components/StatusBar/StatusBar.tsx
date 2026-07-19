import React from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import './StatusBar.css';

export const StatusBar: React.FC = () => {
  const activeTab = useFileStore((state) => state.getActiveTab());
  const { theme, toggleTheme } = useTheme();
  const fontSize = useSettingsStore((state) => state.fontSize);

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        {activeTab ? (activeTab.filePath || '저장되지 않음') : '준비'}
      </div>
      <div className="statusbar-center">
        {/* Cursor line/col could go here */}
        Ln 1, Col 1
      </div>
      <div className="statusbar-right">
        <span className="statusbar-item">글꼴: {fontSize}px</span>
        <button className="theme-toggle" onClick={toggleTheme} title="테마 변경">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  );
};

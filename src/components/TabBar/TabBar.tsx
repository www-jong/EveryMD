import React from 'react';
import { useFileStore } from '../../stores/fileStore';
import './TabBar.css';

export const TabBar: React.FC = () => {
  const tabs = useFileStore((state) => state.tabs);
  const activeTabId = useFileStore((state) => state.activeTabId);
  const setActiveTab = useFileStore((state) => state.setActiveTab);
  const closeTab = useFileStore((state) => state.closeTab);
  const newFile = useFileStore((state) => state.newFile);

  return (
    <div className="tabbar">
      <div className="tabs-container">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-title">{tab.title}</span>
            {tab.isDirty && <span className="tab-dirty">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="tab-new" onClick={newFile} title="새 파일">
        +
      </button>
    </div>
  );
};

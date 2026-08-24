import { create } from 'zustand';
import { Tab } from '../types';
import { baseName } from '../utils/fileSystem';

interface FileState {
  tabs: Tab[];
  activeTabId: string | null;
  openFolderPath: string | null;
  refreshTrigger: number;
  
  // 액션
  newFile: () => void;
  openFile: (filePath: string, content: string, title?: string) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  setActiveTabId: (id: string | null) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, filePath: string) => void;
  renameTabTitle: (id: string, newTitle: string) => void;
  retargetTabPath: (oldPath: string, newPath: string) => void;
  setOpenFolderPath: (path: string | null) => void;
  triggerRefresh: () => void;
  getActiveTab: () => Tab | null;
}

// 로컬스토리지 백업 동기화 헬퍼
const persistWorkspaceState = (tabs: Tab[], activeTabId: string | null) => {
  // 저장 중 무의미하게 거대한 파일 데이터가 남는 것을 방지하되 이전 탭 상태와 경로 정보 복원을 위해 직렬화
  localStorage.setItem('everymd-workspace-tabs', JSON.stringify(tabs));
  localStorage.setItem('everymd-workspace-active-tab-id', activeTabId || '');
};

export const useFileStore = create<FileState>((set, get) => {
  // 이전 상태 복원 로직
  const savedFolder = localStorage.getItem('everymd-open-folder-path') || null;
  const savedTabsJson = localStorage.getItem('everymd-workspace-tabs');
  const savedActiveTabId = localStorage.getItem('everymd-workspace-active-tab-id') || null;
  
  let restoredTabs: Tab[] = [];
  if (savedTabsJson) {
    try {
      restoredTabs = JSON.parse(savedTabsJson);
    } catch (e) {
      restoredTabs = [];
    }
  }

  return {
    tabs: restoredTabs,
    activeTabId: savedActiveTabId,
    openFolderPath: savedFolder,
    refreshTrigger: 0,

    newFile: () => {
      // 1. 최대 문서 탭 한도 제한 검사 (최대 20개)
      if (get().tabs.length >= 20) {
        alert('최대 20개의 문서 탭만 동시에 열어둘 수 있습니다. 더 이상 생성할 수 없습니다.');
        return;
      }

      const id = crypto.randomUUID();
      // 기존에 '제목 없음' 번호 넘버링 구하기
      const untitledCount = get().tabs.filter((t) => t.title.startsWith('Untitled')).length + 1;
      
      const newTab: Tab = {
        id,
        title: `Untitled-${untitledCount}.md`,
        filePath: null,
        content: '',
        isDirty: false,
      };

      const updatedTabs = [...get().tabs, newTab];
      set({ tabs: updatedTabs, activeTabId: id });
      persistWorkspaceState(updatedTabs, id);
    },

    openFile: (filePath, content, title) => {
      // 이미 같은 파일 경로가 탭에 열려 있는지 검사
      const existingTab = get().tabs.find((t) => t.filePath === filePath);
      if (existingTab) {
        set({ activeTabId: existingTab.id });
        persistWorkspaceState(get().tabs, existingTab.id);
        return;
      }

      // 1. 최대 문서 탭 한도 제한 검사 (새 탭 오픈 시에도 적용)
      if (get().tabs.length >= 20) {
        alert('최대 20개의 문서 탭만 동시에 열어둘 수 있습니다. 더 이상 생성할 수 없습니다.');
        return;
      }

      const id = crypto.randomUUID();
      const newTab: Tab = {
        id,
        title: title || baseName(filePath),
        filePath,
        content,
        isDirty: false,
      };

      const updatedTabs = [...get().tabs, newTab];
      set({ tabs: updatedTabs, activeTabId: id });
      persistWorkspaceState(updatedTabs, id);
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      const tabIndex = tabs.findIndex((t) => t.id === id);
      if (tabIndex === -1) return;

      const targetTab = tabs[tabIndex];
      // 미저장 경고 검사
      if (targetTab.isDirty) {
        const confirmClose = window.confirm(`'${targetTab.title}' 파일의 수정사항이 저장되지 않았습니다.\n저장하지 않고 닫으시겠습니까?`);
        if (!confirmClose) return;
      }

      const newTabs = tabs.filter((t) => t.id !== id);
      let newActiveTabId = activeTabId;

      if (activeTabId === id) {
        if (newTabs.length > 0) {
          // 닫은 탭의 이전 탭 혹은 첫 탭 활성화
          newActiveTabId = newTabs[Math.max(0, tabIndex - 1)].id;
        } else {
          newActiveTabId = null;
        }
      }

      set({ tabs: newTabs, activeTabId: newActiveTabId });
      persistWorkspaceState(newTabs, newActiveTabId);
    },

    closeOtherTabs: (id) => {
      const { tabs } = get();
      const otherDirtyTabs = tabs.filter((t) => t.id !== id && t.isDirty);
      
      if (otherDirtyTabs.length > 0) {
        const confirmClose = window.confirm('저장되지 않은 다른 탭들이 있습니다.\n저장하지 않고 모두 닫으시겠습니까?');
        if (!confirmClose) return;
      }

      const newTabs = tabs.filter((t) => t.id === id);
      set({ tabs: newTabs, activeTabId: id });
      persistWorkspaceState(newTabs, id);
    },

    setActiveTabId: (id) => {
      set({ activeTabId: id });
      persistWorkspaceState(get().tabs, id);
    },

    updateContent: (id, content) => {
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          // 실제 콘텐츠 변경 여부 비교 (과도한 isDirty 토글 방지)
          const changed = tab.content !== content;
          return { ...tab, content, isDirty: tab.isDirty || changed };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    markSaved: (id, filePath) => {
      const title = baseName(filePath);
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          return { ...tab, filePath, title, isDirty: false };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    // 디스크에서 파일명이 변경된 경우 열려 있는 탭의 경로/제목을 함께 갱신
    retargetTabPath: (oldPath, newPath) => {
      const title = baseName(newPath);
      const updatedTabs = get().tabs.map((tab) =>
        tab.filePath === oldPath ? { ...tab, filePath: newPath, title } : tab
      );
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    renameTabTitle: (id, newTitle) => {
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          return { ...tab, title: newTitle };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    setOpenFolderPath: (path) => {
      if (path) {
        localStorage.setItem('everymd-open-folder-path', path);
      } else {
        localStorage.removeItem('everymd-open-folder-path');
      }
      set({ openFolderPath: path });
    },

    triggerRefresh: () => {
      set((state) => ({ refreshTrigger: state.refreshTrigger + 1 }));
    },

    getActiveTab: () => {
      const { tabs, activeTabId } = get();
      return tabs.find((t) => t.id === activeTabId) || null;
    },
  };
});

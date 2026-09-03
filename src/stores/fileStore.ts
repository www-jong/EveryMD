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
  closeAllTabs: () => void;
  setActiveTabId: (id: string | null) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, filePath: string, savedContent?: string) => void;
  reloadTabFromDisk: (id: string, diskContent: string) => void;
  applyAutoMerge: (id: string, mergedContent: string, newDiskContent: string) => void;
  markTabDeleted: (id: string, isDeleted: boolean) => void;
  renameTabTitle: (id: string, newTitle: string) => void;
  retargetTabPath: (oldPath: string, newPath: string) => void;
  hydrateTab: (id: string, content: string) => void;
  setOpenFolderPath: (path: string | null) => void;
  triggerRefresh: () => void;
  getActiveTab: () => Tab | null;
}

// 로컬스토리지 백업 동기화 헬퍼
// 디스크 파일은 내용을 저장하지 않고 경로만 저장(재시작 시 디스크에서 복원),
// 미저장(untitled) 탭만 내용을 포함 — 매 키 입력마다 대용량 직렬화 방지
const persistWorkspaceState = (tabs: Tab[], activeTabId: string | null) => {
  const lightweight = tabs.map((t) => (t.filePath ? { ...t, content: '', savedContent: '' } : t));
  try {
    localStorage.setItem('everymd-workspace-tabs', JSON.stringify(lightweight));
    localStorage.setItem('everymd-workspace-active-tab-id', activeTabId || '');
  } catch (e) {
    console.warn('워크스페이스 상태 저장 실패 (저장 용량 초과):', e);
  }
};

export const useFileStore = create<FileState>((set, get) => {
  // 이전 상태 복원 로직
  const savedFolder = localStorage.getItem('everymd-open-folder-path') || null;
  const savedTabsJson = localStorage.getItem('everymd-workspace-tabs');
  const savedActiveTabId = localStorage.getItem('everymd-workspace-active-tab-id') || null;
  
  let restoredTabs: Tab[] = [];
  if (savedTabsJson) {
    try {
      restoredTabs = JSON.parse(savedTabsJson).map((t: any) => ({
        ...t,
        savedContent: t.savedContent ?? t.content ?? '',
      }));
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
        savedContent: '',
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
        savedContent: content,
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
      const newTabs = get().tabs.filter((t) => t.id === id);
      set({ tabs: newTabs, activeTabId: id });
      persistWorkspaceState(newTabs, id);
    },

    closeAllTabs: () => {
      set({ tabs: [], activeTabId: null });
      persistWorkspaceState([], null);
    },

    setActiveTabId: (id) => {
      set({ activeTabId: id });
      persistWorkspaceState(get().tabs, id);
    },

    updateContent: (id, content) => {
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          // savedContent와 비교하여 정확한 isDirty 계산
          const isDirty = tab.savedContent !== content;
          return { ...tab, content, isDirty };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    markSaved: (id, filePath, savedContent) => {
      const title = baseName(filePath);
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          const contentToSave = savedContent !== undefined ? savedContent : tab.content;
          return {
            ...tab,
            filePath,
            title,
            content: contentToSave,
            savedContent: contentToSave,
            isDirty: false,
            isDeletedFromDisk: false,
          };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    // 외부 디스크 변경 사항을 탭에 안전하게 덮어쓰며 리로드 (Silent Reload 또는 Revert 선택 시)
    reloadTabFromDisk: (id, diskContent) => {
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          return {
            ...tab,
            content: diskContent,
            savedContent: diskContent,
            isDirty: false,
            isDeletedFromDisk: false,
          };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    // 겹치지 않는 3-Way Auto-Merge 결과 반영
    applyAutoMerge: (id, mergedContent, newDiskContent) => {
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id) {
          return {
            ...tab,
            content: mergedContent,
            savedContent: newDiskContent,
            isDirty: mergedContent !== newDiskContent,
            isDeletedFromDisk: false,
          };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      persistWorkspaceState(updatedTabs, get().activeTabId);
    },

    // 디스크에서 파일이 삭제/소실되었을 때 상태 마킹
    markTabDeleted: (id, isDeleted) => {
      const updatedTabs = get().tabs.map((tab) => {
        if (tab.id === id && tab.isDeletedFromDisk !== isDeleted) {
          return { ...tab, isDeletedFromDisk: isDeleted };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
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

    // 재시작 후 디스크 파일 내용 복원 (dirty 상태가 아닌 빈 탭에만 적용해 사용자 편집 보호)
    hydrateTab: (id, content) => {
      const updatedTabs = get().tabs.map((tab) =>
        tab.id === id && !tab.isDirty && tab.content === ''
          ? { ...tab, content, savedContent: content }
          : tab
      );
      set({ tabs: updatedTabs });
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

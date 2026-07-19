import { create } from 'zustand';
import { Tab } from '../types';

interface FileState {
  tabs: Tab[];
  activeTabId: string | null;
  untitledCounter: number;
  newFile: () => void;
  openFile: (path: string, content: string, name?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string, path?: string, name?: string) => void;
  getActiveTab: () => Tab | undefined;
}

export const useFileStore = create<FileState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  untitledCounter: 1,

  newFile: () => {
    const { untitledCounter, tabs } = get();
    const id = crypto.randomUUID();
    const newTab: Tab = {
      id,
      title: `Untitled-${untitledCounter}.md`,
      filePath: null,
      content: '',
      isDirty: false,
    };
    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
      untitledCounter: untitledCounter + 1,
    });
  },

  openFile: (path, content, name) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.filePath === path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    const id = crypto.randomUUID();
    const fileName = name || path.split(/[/\\]/).pop() || 'Unknown.md';
    const newTab: Tab = {
      id,
      title: fileName,
      filePath: path,
      content,
      isDirty: false,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
    });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;

    if (activeTabId === id) {
      const idx = tabs.findIndex((t) => t.id === id);
      if (newTabs.length > 0) {
        newActiveId = newTabs[Math.max(0, idx - 1)].id;
      } else {
        newActiveId = null;
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) => (t.id === id ? { ...t, content, isDirty: true } : t));
    set({ tabs: newTabs });
  },

  markSaved: (id, path, name) => {
    const { tabs } = get();
    const newTabs = tabs.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          isDirty: false,
          ...(path ? { filePath: path } : {}),
          ...(name ? { title: name } : {}),
        };
      }
      return t;
    });
    set({ tabs: newTabs });
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },
}));

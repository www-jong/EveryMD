import { useCallback } from 'react';
import { useFileStore } from '../stores/fileStore';
import { openFileDialog, saveFileDialog, readFile, writeFile, renameFile } from '../utils/fileSystem';

export const useFileSystem = () => {
  const newFile = useFileStore((state) => state.newFile);
  const openFile = useFileStore((state) => state.openFile);
  const closeTab = useFileStore((state) => state.closeTab);
  const markSaved = useFileStore((state) => state.markSaved);
  const renameTabTitle = useFileStore((state) => state.renameTabTitle);
  const getActiveTab = useFileStore((state) => state.getActiveTab);

  const handleNew = useCallback(() => {
    newFile();
  }, [newFile]);

  const handleOpen = useCallback(async () => {
    try {
      const path = await openFileDialog();
      if (path) {
        const content = await readFile(path);
        openFile(path, content);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, [openFile]);

  const handleSave = useCallback(async () => {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    try {
      let pathToSave = activeTab.filePath;

      if (!pathToSave) {
        // defaultName으로 탭 제목을 넘겨 다이얼로그에 채워줌
        const dialogPath = await saveFileDialog(activeTab.title);
        if (!dialogPath) return;
        pathToSave = dialogPath;
      }

      await writeFile(pathToSave, activeTab.content);
      markSaved(activeTab.id, pathToSave, activeTab.content);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [getActiveTab, markSaved]);

  const handleSaveAs = useCallback(async () => {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    try {
      const pathToSave = await saveFileDialog(activeTab.title);
      if (!pathToSave) return;

      await writeFile(pathToSave, activeTab.content);
      markSaved(activeTab.id, pathToSave, activeTab.content);
    } catch (error) {
      console.error('Failed to save file as:', error);
    }
  }, [getActiveTab, markSaved]);

  const handleCloseTab = useCallback((id: string) => {
    closeTab(id);
  }, [closeTab]);

  const performRename = useCallback(async (tabId: string, newTitle: string) => {
    const tab = useFileStore.getState().tabs.find(t => t.id === tabId);
    if (!tab) return;
    const trimmed = newTitle.trim();
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

        if (tab.isDirty) {
          await writeFile(tab.filePath, tab.content);
        }

        await renameFile(tab.filePath, newPath);
        renameTabTitle(tabId, trimmed);
        markSaved(tabId, newPath);
      } else {
        renameTabTitle(tabId, trimmed);
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      throw error;
    }
  }, [renameTabTitle, markSaved]);

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleCloseTab,
    performRename,
  };
};

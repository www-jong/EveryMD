import { useCallback } from 'react';
import { useFileStore } from '../stores/fileStore';
import { openFileDialog, saveFileDialog, readFile, writeFile } from '../utils/fileSystem';

export const useFileSystem = () => {
  const newFile = useFileStore((state) => state.newFile);
  const openFile = useFileStore((state) => state.openFile);
  const closeTab = useFileStore((state) => state.closeTab);
  const markSaved = useFileStore((state) => state.markSaved);
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
      let newName: string | undefined;

      if (!pathToSave) {
        const dialogPath = await saveFileDialog();
        if (!dialogPath) return;
        pathToSave = dialogPath;
        newName = pathToSave.split(/[/\\]/).pop();
      }

      await writeFile(pathToSave, activeTab.content);
      markSaved(activeTab.id, pathToSave, newName);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [getActiveTab, markSaved]);

  const handleSaveAs = useCallback(async () => {
    const activeTab = getActiveTab();
    if (!activeTab) return;

    try {
      const pathToSave = await saveFileDialog();
      if (!pathToSave) return;

      const newName = pathToSave.split(/[/\\]/).pop();
      await writeFile(pathToSave, activeTab.content);
      markSaved(activeTab.id, pathToSave, newName);
    } catch (error) {
      console.error('Failed to save file as:', error);
    }
  }, [getActiveTab, markSaved]);

  const handleCloseTab = useCallback((id: string) => {
    closeTab(id);
  }, [closeTab]);

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleCloseTab,
  };
};

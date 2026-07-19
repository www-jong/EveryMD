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
      // markSaved 파라미터는 2개만 넘겨야 타입 불일치가 나지 않습니다. (id, filePath)
      markSaved(activeTab.id, pathToSave);
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
      // markSaved 파라미터는 2개만 넘겨야 타입 불일치가 나지 않습니다. (id, filePath)
      markSaved(activeTab.id, pathToSave);
    } catch (error) {
      console.error('Failed to save file as:', error);
    }
  }, [getActiveTab, markSaved]);

  const handleCloseTab = useCallback((id: string) => {
    closeTab(id);
  }, [closeTab]);

  const handleRename = useCallback(async (tabId: string) => {
    const tab = useFileStore.getState().tabs.find(t => t.id === tabId);
    if (!tab) return;

    const newTitle = prompt('새 파일 이름을 입력하세요 (확장자 .md 포함):', tab.title);
    if (!newTitle || newTitle === tab.title) return;

    try {
      if (tab.filePath) {
        // 기존 파일 경로가 있는 경우 디스크 이름 변경 처리
        const sep = tab.filePath.includes('/') ? '/' : '\\';
        const pathParts = tab.filePath.split(/[/\\]/);
        pathParts.pop(); // 파일명 제외
        const parentPath = pathParts.join(sep);
        const newPath = parentPath + sep + newTitle;

        await renameFile(tab.filePath, newPath);
        // 디스크 변경 완료 후 스토어 상태 변경
        renameTabTitle(tabId, newTitle);
        markSaved(tabId, newPath); // 스토어의 파일 경로 갱신 처리 연계
      } else {
        // 새 파일 상태에서 타이틀만 바꾸는 경우
        renameTabTitle(tabId, newTitle);
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert('파일 이름 변경에 실패했습니다.');
    }
  }, [renameTabTitle, markSaved]);

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleSaveAs,
    handleCloseTab,
    handleRename,
  };
};

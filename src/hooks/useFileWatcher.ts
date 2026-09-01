import { useEffect, useRef, useState, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useFileStore } from '../stores/fileStore';
import { useSettingsStore } from '../stores/settingsStore';
import { readFile, writeFile, isTauri } from '../utils/fileSystem';
import { FileConflictInfo } from '../types';

import { threeWayMerge } from '../utils/diff';

export const useFileWatcher = () => {
  const reloadTabFromDisk = useFileStore((state) => state.reloadTabFromDisk);
  const applyAutoMerge = useFileStore((state) => state.applyAutoMerge);
  const markTabDeleted = useFileStore((state) => state.markTabDeleted);
  const [conflictInfo, setConflictInfo] = useState<FileConflictInfo | null>(null);
  const isCheckingRef = useRef(false);

  // 외부 파일 변경 사항 검사 함수
  const checkExternalChanges = useCallback(async () => {
    if (isCheckingRef.current) return;
    if (conflictInfo) return; // 이미 충돌 모달이 떠 있으면 중복 검사 보류

    isCheckingRef.current = true;
    try {
      const currentTabs = useFileStore.getState().tabs;
      for (const tab of currentTabs) {
        if (!tab.filePath) continue;

        try {
          const diskContent = await readFile(tab.filePath);

          // 삭제 상태였다가 다시 파일이 나타난 경우 복구
          if (tab.isDeletedFromDisk) {
            markTabDeleted(tab.id, false);
          }

          // 디스크 내용이 마지막 동기화 내용(savedContent)과 다른 경우 -> 외부 수정 감지됨
          if (diskContent !== tab.savedContent) {
            if (!tab.isDirty) {
              // 1. 에디터에 미저장 수정사항이 없는 경우 -> 자동 무음 리로드 (Typora / VS Code 표준)
              console.log(`[FileWatcher] 외부 파일 변경 감지 -> 자동 리로드: ${tab.filePath}`);
              reloadTabFromDisk(tab.id, diskContent);
            } else {
              // 2. 에디터에서도 수정 중인 경우 -> 3-Way Auto-Merge 시도
              const mergeResult = threeWayMerge(tab.savedContent, tab.content, diskContent);
              if (!mergeResult.hasConflict) {
                // 겹치지 않는 서로 다른 행의 수정 -> 자동 병합하여 양쪽 수정 모두 안전 반영!
                console.log(`[FileWatcher] 겹치지 않는 변경사항 자동 병합 성공: ${tab.filePath}`);
                applyAutoMerge(tab.id, mergeResult.mergedContent, diskContent);
              } else {
                // 동일한 행을 서로 다르게 수정한 진짜 충돌 -> 충돌 모달 표시
                console.warn(`[FileWatcher] 파일 충돌 감지 (동일 행 충돌): ${tab.filePath}`);
                setConflictInfo({
                  tabId: tab.id,
                  title: tab.title,
                  filePath: tab.filePath,
                  localContent: tab.content,
                  diskContent,
                  baseContent: tab.savedContent,
                });
                break; // 한 번에 한 개의 충돌 모달 처리
              }
            }
          }
        } catch (readErr) {
          // 파일이 삭제되었거나 브랜치 전환 등으로 사라진 경우
          console.warn(`[FileWatcher] 디스크 파일 소실 감지 (삭제 또는 브랜치 변경): ${tab.filePath}`);
          markTabDeleted(tab.id, true);
        }
      }
    } catch (e) {
      console.error('[FileWatcher] 외부 파일 변경 검사 중 오류:', e);
    } finally {
      isCheckingRef.current = false;
    }
  }, [conflictInfo, reloadTabFromDisk, applyAutoMerge, markTabDeleted]);

  // 창 벗어남(Blur) 시 미저장된 디스크 파일들을 즉시 디스크에 자동 저장
  const saveDirtyTabsOnBlur = useCallback(async () => {
    // saveOnBlur 설정이 꺼져 있으면 즉시 반환
    if (!useSettingsStore.getState().saveOnBlur) return;

    const currentTabs = useFileStore.getState().tabs;
    for (const tab of currentTabs) {
      if (tab.filePath && tab.isDirty) {
        try {
          console.log(`[FileWatcher] 창 벗어남(Blur) 감지 -> 즉시 자동 저장: ${tab.filePath}`);
          await writeFile(tab.filePath, tab.content);
          useFileStore.getState().markSaved(tab.id, tab.filePath, tab.content);
        } catch (err) {
          console.error('[FileWatcher] Blur 자동 저장 실패:', err);
        }
      }
    }
  }, []);

  useEffect(() => {
    // 1. 브라우저/웹뷰 Window Blur & Focus 이벤트 리스너 등록
    const handleWindowBlur = () => {
      saveDirtyTabsOnBlur();
    };
    const handleWindowFocus = () => {
      checkExternalChanges();
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // 2. Tauri Window Blur & Focus 이벤트 리스너
    let unlistenTauriBlur: (() => void) | null = null;
    let unlistenTauriFocus: (() => void) | null = null;
    if (isTauri()) {
      const win = getCurrentWindow();

      win.listen('tauri://blur', () => {
        saveDirtyTabsOnBlur();
      }).then((unsub) => {
        unlistenTauriBlur = unsub;
      }).catch((e) => {
        console.error('[FileWatcher] Tauri blur 리스너 등록 실패:', e);
      });

      win.listen('tauri://focus', () => {
        checkExternalChanges();
      }).then((unsub) => {
        unlistenTauriFocus = unsub;
      }).catch((e) => {
        console.error('[FileWatcher] Tauri focus 리스너 등록 실패:', e);
      });
    }

    // 3. 주기적 백그라운드 폴링 (3초 간격)
    const intervalTimer = setInterval(() => {
      if (document.hasFocus()) {
        checkExternalChanges();
      }
    }, 3000);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      unlistenTauriBlur?.();
      unlistenTauriFocus?.();
      clearInterval(intervalTimer);
    };
  }, [checkExternalChanges, saveDirtyTabsOnBlur]);

  const resolveConflict = useCallback(() => {
    setConflictInfo(null);
  }, []);

  return {
    conflictInfo,
    resolveConflict,
    checkExternalChanges,
  };
};

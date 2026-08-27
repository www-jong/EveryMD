import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useFileStore } from '../stores/fileStore';
import { readFile, baseName, isTauri } from '../utils/fileSystem';

export const useFileAssociation = () => {
  const openFile = useFileStore((state) => state.openFile);
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;

  useEffect(() => {
    if (!isTauri()) return;

    let isMounted = true;

    const handleOpenFile = async (rawPath: string) => {
      if (!rawPath || typeof rawPath !== 'string') return;
      
      let filePath = rawPath.trim();
      // 따옴표로 감싸진 경우 제거 (Windows CLI 인자 전달 시)
      if (
        (filePath.startsWith('"') && filePath.endsWith('"')) ||
        (filePath.startsWith("'") && filePath.endsWith("'"))
      ) {
        filePath = filePath.slice(1, -1);
      }

      if (!filePath) return;

      try {
        const content = await readFile(filePath);
        if (!isMounted) return;
        const fileName = baseName(filePath);
        openFileRef.current(filePath, content, fileName);
      } catch (err) {
        console.error(`[FileAssociation] Failed to open file: ${filePath}`, err);
      }
    };

    // 1. Cold Start: 앱 시작 시 Rust 백엔드에 큐잉된 초기 파일 목록 가져오기
    invoke<string[]>('get_initial_files')
      .then((files) => {
        if (!isMounted || !Array.isArray(files)) return;
        files.forEach((path) => {
          handleOpenFile(path);
        });
      })
      .catch((err) => {
        console.error('[FileAssociation] Failed to fetch initial files:', err);
      });

    // 2. Warm Start: 앱 실행 중 OS 우클릭/더블클릭/SingleInstance로 전달된 파일 이벤트 수신
    const unlistenPromise = listen<string>('open-file-requested', (event) => {
      if (event.payload) {
        handleOpenFile(event.payload);
      }
    });

    return () => {
      isMounted = false;
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
};

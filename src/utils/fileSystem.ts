import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { FileEntry } from '../types';

// Tauri 환경인지 감지하는 유틸리티
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

export const openFileDialog = async (): Promise<string | null> => {
  if (!isTauri()) {
    console.warn('Tauri API는 Tauri 앱 내부에서만 작동합니다. 브라우저 가상 열기를 시도합니다.');
    alert('웹 브라우저 데모 모드: 가상의 데모 마크다운 파일을 생성합니다.');
    return 'demo_file.md';
  }
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    return selected ?? null;
  } catch (error) {
    console.error('파일 다이얼로그 열기 실패:', error);
    return null;
  }
};

export const saveFileDialog = async (): Promise<string | null> => {
  if (!isTauri()) {
    console.warn('Tauri API는 Tauri 앱 내부에서만 작동합니다. 브라우저 가상 저장을 시도합니다.');
    const fileName = prompt('저장할 파일명을 입력하세요:', 'Untitled.md');
    return fileName ? `/virtual/${fileName}` : null;
  }
  try {
    const selected = await save({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    return selected || null;
  } catch (error) {
    console.error('파일 저장 다이얼로그 열기 실패:', error);
    return null;
  }
};

export const readFile = async (path: string): Promise<string> => {
  if (!isTauri()) {
    if (path === 'demo_file.md') {
      return '# EveryMD 데모 파일\n\n브라우저에서 작동 확인 중입니다. **WYSIWYG** 기능을 사용해 보세요!\n- [x] 다크모드/라이트모드 지원\n- [ ] 로컬 파일 실제 동기화 (Tauri 앱 내에서 지원)';
    }
    const virtualFiles = JSON.parse(localStorage.getItem('everymd-virtual-files') || '{}');
    return virtualFiles[path] || '# 새로운 문서\n내용을 여기에 입력하세요.';
  }
  return await readTextFile(path);
};

export const writeFile = async (path: string, content: string): Promise<void> => {
  if (!isTauri()) {
    const virtualFiles = JSON.parse(localStorage.getItem('everymd-virtual-files') || '{}');
    virtualFiles[path] = content;
    localStorage.setItem('everymd-virtual-files', JSON.stringify(virtualFiles));
    alert(`브라우저 가상 저장 완료: ${path}`);
    return;
  }
  await writeTextFile(path, content);
};

export const openFolderDialog = async (): Promise<string | null> => {
  if (!isTauri()) {
    console.warn('Tauri API는 Tauri 앱 내부에서만 작동합니다. 브라우저 가상 폴더를 반환합니다.');
    return 'demo_workspace';
  }
  try {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    return selected ?? null;
  } catch (error) {
    console.error('폴더 열기 다이얼로그 실패:', error);
    return null;
  }
};

export const readDirectory = async (path: string): Promise<FileEntry[]> => {
  if (!isTauri()) {
    if (path === 'demo_workspace') {
      return [
        { name: 'README.md', path: 'demo_workspace/README.md', isDir: false },
        { name: 'Notes', path: 'demo_workspace/Notes', isDir: true },
        { name: 'Draft.md', path: 'demo_workspace/Draft.md', isDir: false }
      ];
    }
    if (path === 'demo_workspace/Notes') {
      return [
        { name: 'Idea.md', path: 'demo_workspace/Notes/Idea.md', isDir: false }
      ];
    }
    return [];
  }
  try {
    const entries = await readDir(path);
    const sep = path.includes('/') ? '/' : '\\';
    return entries.map((entry) => ({
      name: entry.name || 'Unknown',
      path: path + sep + entry.name,
      isDir: entry.isDirectory,
    })).sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('디렉토리 읽기 실패:', error);
    return [];
  }
};

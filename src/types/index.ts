export interface Tab {
  id: string;
  title: string;
  filePath: string | null;
  content: string;
  savedContent: string; // 디스크와 동기화된 마지막 원본 내용
  isDirty: boolean;
  isDeletedFromDisk?: boolean; // 디스크에서 삭제/브랜치 변경으로 파일이 사라진 상태
}

export interface FileConflictInfo {
  tabId: string;
  title: string;
  filePath: string;
  localContent: string;
  diskContent: string;
  baseContent?: string;
}


export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}

export type ThemeMode = 'light' | 'dark';

export interface Settings {
  theme: ThemeMode;
  fontSize: number;
  autoSave: boolean;
  autoSaveDelay: number;
  wordWrap: boolean; // 설정창 제어 옵션 추가
}

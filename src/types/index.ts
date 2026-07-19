export interface Tab {
  id: string;
  title: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
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
}

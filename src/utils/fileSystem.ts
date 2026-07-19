import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { FileEntry } from '../types';

export const openFileDialog = async (): Promise<string | null> => {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  return selected ?? null;
};

export const saveFileDialog = async (): Promise<string | null> => {
  const selected = await save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  return selected || null;
};

export const readFile = async (path: string): Promise<string> => {
  return await readTextFile(path);
};

export const writeFile = async (path: string, content: string): Promise<void> => {
  await writeTextFile(path, content);
};

export const openFolderDialog = async (): Promise<string | null> => {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  return selected ?? null;
};

export const readDirectory = async (path: string): Promise<FileEntry[]> => {
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
};

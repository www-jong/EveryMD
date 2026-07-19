import { create } from 'zustand';
import { Settings, ThemeMode } from '../types';

interface SettingsState extends Settings {
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
  setAutoSave: (autoSave: boolean) => void;
  setAutoSaveDelay: (delay: number) => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('everymd-theme') as ThemeMode;
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initialState: Settings = {
    theme: getInitialTheme(),
    fontSize: Number(localStorage.getItem('everymd-fontSize')) || 16,
    autoSave: localStorage.getItem('everymd-autoSave') === 'true',
    autoSaveDelay: Number(localStorage.getItem('everymd-autoSaveDelay')) || 2000,
  };

  return {
    ...initialState,
    setTheme: (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('everymd-theme', theme);
      set({ theme });
    },
    toggleTheme: () => {
      const newTheme = get().theme === 'light' ? 'dark' : 'light';
      get().setTheme(newTheme);
    },
    setFontSize: (fontSize) => {
      localStorage.setItem('everymd-fontSize', fontSize.toString());
      set({ fontSize });
    },
    setAutoSave: (autoSave) => {
      localStorage.setItem('everymd-autoSave', autoSave.toString());
      set({ autoSave });
    },
    setAutoSaveDelay: (autoSaveDelay) => {
      localStorage.setItem('everymd-autoSaveDelay', autoSaveDelay.toString());
      set({ autoSaveDelay });
    },
  };
});

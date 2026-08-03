import { create } from 'zustand';
import { ThemeMode } from '../types';

export interface ThemeColors {
  '--bg-main': string;
  '--bg-sidebar': string;
  '--bg-titlebar': string;
  '--bg-hover': string;
  '--bg-active': string;
  '--bg-statusbar': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-muted': string;
  '--statusbar-text': string;
  '--accent-color': string;
  '--accent-hover': string;
  '--border-color': string;
  '--code-bg': string;
  '--code-text': string;
}

export interface CustomTheme {
  id: string;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}

export interface ShortcutMap {
  newFile: string;     // e.g. "Control+n"
  openFile: string;    // e.g. "Control+o"
  saveFile: string;    // e.g. "Control+s"
  saveAsFile: string;  // e.g. "Control+Shift+S"
  closeTab: string;    // e.g. "Control+w"
  toggleTheme: string; // e.g. "Control+Shift+L"
  toggleSidebar: string; // e.g. "Control+b"
  openSettings: string; // e.g. "Control+,"
}

interface SettingsState {
  theme: ThemeMode; // 'light' | 'dark'
  fontSize: number;
  fontFamily: string;
  autoSave: boolean;
  autoSaveDelay: number;
  wordWrap: boolean;
  isSettingsOpen: boolean;
  shortcuts: ShortcutMap;
  customThemes: CustomTheme[];
  activeThemeId: string; // 'light' | 'dark' | 커스텀 테마 ID
  
  // 액션
  setSettingsOpen: (isOpen: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setAutoSave: (autoSave: boolean) => void;
  setAutoSaveDelay: (delay: number) => void;
  setWordWrap: (wordWrap: boolean) => void;
  updateShortcut: (action: keyof ShortcutMap, keyCombination: string) => void;
  resetShortcuts: () => void;
  
  // 테마 관리 액션
  setActiveThemeId: (themeId: string) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  updateCustomThemeColors: (themeId: string, colors: Partial<ThemeColors>) => void;
  deleteCustomTheme: (themeId: string) => void;
  importTheme: (themeJson: string) => boolean;
}

// 1. 기본 테마 프리셋 정의
export const THEME_PRESETS: Record<string, CustomTheme> = {
  light: {
    id: 'light',
    name: '기본 라이트 테마',
    isDark: false,
    colors: {
      '--bg-main': '#FFFFFF',
      '--bg-sidebar': '#F8F9FA',
      '--bg-titlebar': '#F1F3F5',
      '--bg-hover': '#E9ECEF',
      '--bg-active': '#E2E8F0',
      '--bg-statusbar': '#E9ECEF',
      '--text-primary': '#1A1A2E',
      '--text-secondary': '#495057',
      '--text-muted': '#868E96',
      '--statusbar-text': '#495057',
      '--accent-color': '#6366F1',
      '--accent-hover': '#4F46E5',
      '--border-color': '#E9ECEF',
      '--code-bg': '#F1F3F5',
      '--code-text': '#7C3AED'
    }
  },
  dark: {
    id: 'dark',
    name: '기본 다크 테마',
    isDark: true,
    colors: {
      '--bg-main': '#1E1E2E',
      '--bg-sidebar': '#181825',
      '--bg-titlebar': '#11111B',
      '--bg-hover': '#313244',
      '--bg-active': '#45475A',
      '--bg-statusbar': '#11111B',
      '--text-primary': '#CDD6F4',
      '--text-secondary': '#A6ADC8',
      '--text-muted': '#6C7086',
      '--statusbar-text': '#A6ADC8',
      '--accent-color': '#B4BEFE',
      '--accent-hover': '#A6E3A1',
      '--border-color': '#313244',
      '--code-bg': '#11111B',
      '--code-text': '#CBA6F7'
    }
  },
  solarized: {
    id: 'solarized',
    name: 'Solarized Light',
    isDark: false,
    colors: {
      '--bg-main': '#FDF6E3',
      '--bg-sidebar': '#EEE8D5',
      '--bg-titlebar': '#93A1A1',
      '--bg-hover': '#D3C6A2',
      '--bg-active': '#BEB99A',
      '--bg-statusbar': '#93A1A1',
      '--text-primary': '#073642',
      '--text-secondary': '#586E75',
      '--text-muted': '#93A1A1',
      '--statusbar-text': '#073642',
      '--accent-color': '#B58900',
      '--accent-hover': '#CB4B16',
      '--border-color': '#D3C6A2',
      '--code-bg': '#EEE8D5',
      '--code-text': '#DC322F'
    }
  },
  onedark: {
    id: 'onedark',
    name: 'One Dark Pro',
    isDark: true,
    colors: {
      '--bg-main': '#282C34',
      '--bg-sidebar': '#21252B',
      '--bg-titlebar': '#1E2227',
      '--bg-hover': '#2C313A',
      '--bg-active': '#3E4451',
      '--bg-statusbar': '#1E2227',
      '--text-primary': '#ABB2BF',
      '--text-secondary': '#828997',
      '--text-muted': '#5C6370',
      '--statusbar-text': '#ABB2BF',
      '--accent-color': '#61AFEF',
      '--accent-hover': '#98C379',
      '--border-color': '#3E4451',
      '--code-bg': '#21252B',
      '--code-text': '#E5C07B'
    }
  }
};

const DEFAULT_SHORTCUTS: ShortcutMap = {
  newFile: 'ctrl+n',
  openFile: 'ctrl+o',
  saveFile: 'ctrl+s',
  saveAsFile: 'ctrl+shift+s',
  closeTab: 'ctrl+w',
  toggleTheme: 'ctrl+shift+l',
  toggleSidebar: 'ctrl+\\',
  openSettings: 'ctrl+,'
};

// CSS 변수를 document에 일괄 주입하는 유틸리티
export const applyThemeColors = (colors: ThemeColors) => {
  Object.entries(colors).forEach(([key, val]) => {
    document.documentElement.style.setProperty(key, val);
  });
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  // 로컬스토리지 저장 데이터 복원
  const savedActiveThemeId = localStorage.getItem('everymd-active-theme-id') || 'dark';
  const savedCustomThemes = JSON.parse(localStorage.getItem('everymd-custom-themes') || '[]');
  // 저장된 단축키 로드 + 마이그레이션 (ctrl+b → ctrl+\\ 변경으로 인한 호환성 처리)
  const savedShortcuts = JSON.parse(localStorage.getItem('everymd-shortcuts') || 'null');
  let migratedShortcuts: ShortcutMap = savedShortcuts
    ? { ...DEFAULT_SHORTCUTS, ...savedShortcuts }
    : { ...DEFAULT_SHORTCUTS };
  if (migratedShortcuts.toggleSidebar === 'ctrl+b') {
    migratedShortcuts.toggleSidebar = 'ctrl+\\';
    localStorage.setItem('everymd-shortcuts', JSON.stringify(migratedShortcuts));
  }
  
  const getThemeColors = (themeId: string, customList: CustomTheme[]): ThemeColors => {
    if (THEME_PRESETS[themeId]) return THEME_PRESETS[themeId].colors;
    const found = customList.find(t => t.id === themeId);
    return found ? found.colors : THEME_PRESETS.dark.colors;
  };

  const initialThemeId = savedActiveThemeId;
  const initialCustomThemes = savedCustomThemes;
  const initialColors = getThemeColors(initialThemeId, initialCustomThemes);
  applyThemeColors(initialColors);

  // 폰트 크기 초기 복원
  const initialFontSize = Number(localStorage.getItem('everymd-fontSize')) || 16;
  document.documentElement.style.setProperty('--editor-font-size', `${initialFontSize}px`);

  // 폰트 패밀리 초기 복원
  const initialFontFamily = localStorage.getItem('everymd-fontFamily') || 'Inter';
  document.documentElement.style.setProperty('--editor-font-family', initialFontFamily);

  return {
    theme: (initialThemeId === 'light' || (THEME_PRESETS[initialThemeId] && !THEME_PRESETS[initialThemeId].isDark)) ? 'light' : 'dark',
    fontSize: initialFontSize,
    fontFamily: initialFontFamily,
    autoSave: localStorage.getItem('everymd-autoSave') === 'true',
    autoSaveDelay: Number(localStorage.getItem('everymd-autoSaveDelay')) || 2000,
    wordWrap: localStorage.getItem('everymd-wordWrap') !== 'false',
    isSettingsOpen: false,
    shortcuts: migratedShortcuts,
    customThemes: initialCustomThemes,
    activeThemeId: initialThemeId,

    setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
    
    setTheme: (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('everymd-theme', theme);
      
      const themeId = theme === 'light' ? 'light' : 'dark';
      get().setActiveThemeId(themeId);
    },

    toggleTheme: () => {
      const newTheme = get().theme === 'light' ? 'dark' : 'light';
      get().setTheme(newTheme);
    },

    setFontSize: (fontSize) => {
      localStorage.setItem('everymd-fontSize', fontSize.toString());
      document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
      set({ fontSize });
    },

    setFontFamily: (fontFamily) => {
      localStorage.setItem('everymd-fontFamily', fontFamily);
      document.documentElement.style.setProperty('--editor-font-family', fontFamily);
      set({ fontFamily });
    },

    setAutoSave: (autoSave) => {
      localStorage.setItem('everymd-autoSave', autoSave.toString());
      set({ autoSave });
    },

    setAutoSaveDelay: (autoSaveDelay) => {
      localStorage.setItem('everymd-autoSaveDelay', autoSaveDelay.toString());
      set({ autoSaveDelay });
    },

    setWordWrap: (wordWrap) => {
      localStorage.setItem('everymd-wordWrap', wordWrap.toString());
      set({ wordWrap });
    },

    updateShortcut: (action, keyCombination) => {
      const updatedShortcuts = { ...get().shortcuts, [action]: keyCombination.toLowerCase() };
      localStorage.setItem('everymd-shortcuts', JSON.stringify(updatedShortcuts));
      set({ shortcuts: updatedShortcuts });
    },

    resetShortcuts: () => {
      localStorage.setItem('everymd-shortcuts', JSON.stringify(DEFAULT_SHORTCUTS));
      set({ shortcuts: { ...DEFAULT_SHORTCUTS } });
    },

    setActiveThemeId: (themeId) => {
      localStorage.setItem('everymd-active-theme-id', themeId);
      const colors = getThemeColors(themeId, get().customThemes);
      applyThemeColors(colors);
      
      const preset = THEME_PRESETS[themeId];
      let resolvedMode: ThemeMode = 'dark';
      if (preset) {
        resolvedMode = preset.isDark ? 'dark' : 'light';
      } else {
        const custom = get().customThemes.find(t => t.id === themeId);
        if (custom) resolvedMode = custom.isDark ? 'dark' : 'light';
      }
      
      document.documentElement.setAttribute('data-theme', resolvedMode);
      set({ activeThemeId: themeId, theme: resolvedMode });
    },

    addCustomTheme: (newTheme) => {
      const updatedList = [...get().customThemes, newTheme];
      localStorage.setItem('everymd-custom-themes', JSON.stringify(updatedList));
      set({ customThemes: updatedList });
      get().setActiveThemeId(newTheme.id);
    },

    updateCustomThemeColors: (themeId, colors) => {
      const updatedList = get().customThemes.map(t => {
        if (t.id === themeId) {
          return { ...t, colors: { ...t.colors, ...colors } };
        }
        return t;
      });
      localStorage.setItem('everymd-custom-themes', JSON.stringify(updatedList));
      set({ customThemes: updatedList });
      
      if (get().activeThemeId === themeId) {
        const activeTheme = updatedList.find(t => t.id === themeId);
        if (activeTheme) applyThemeColors(activeTheme.colors);
      }
    },

    deleteCustomTheme: (themeId) => {
      const updatedList = get().customThemes.filter(t => t.id !== themeId);
      localStorage.setItem('everymd-custom-themes', JSON.stringify(updatedList));
      set({ customThemes: updatedList });
      if (get().activeThemeId === themeId) {
        get().setActiveThemeId('dark');
      }
    },

    importTheme: (themeJson) => {
      try {
        const parsed = JSON.parse(themeJson);
        if (parsed && parsed.id && parsed.name && parsed.colors) {
          // 중복 검사 및 덮어쓰기/추가
          const id = parsed.id + '_' + Date.now(); // ID 고유화
          const newTheme: CustomTheme = {
            id,
            name: parsed.name + ' (Imported)',
            isDark: parsed.isDark !== undefined ? parsed.isDark : true,
            // 기존 다크 프리셋 기반으로 병합 (--code-text 포함 누락 방지)
            colors: { ...THEME_PRESETS.dark.colors, ...parsed.colors }
          };
          get().addCustomTheme(newTheme);
          return true;
        }
        return false;
      } catch (err) {
        console.error('테마 가져오기 실패:', err);
        return false;
      }
    }
  };
});

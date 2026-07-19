import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export const useTheme = () => {
  const theme = useSettingsStore((state) => state.theme);
  const toggleTheme = useSettingsStore((state) => state.toggleTheme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return { theme, toggleTheme, setTheme };
};

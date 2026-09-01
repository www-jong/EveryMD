import { isMacOS } from './platform';

/**
 * 단축키 조합 문자열(e.g. "ctrl+s", "ctrl+shift+s")을 OS에 맞게 시각화 포맷팅합니다.
 * - macOS: ⌘S, ⇧⌘S, ⌘\, ⌥⌘T 등 Apple 표준 기호 사용
 * - Windows/Linux: Ctrl+S, Ctrl+Shift+S, Ctrl+\ 등 텍스트 조합 사용
 */
export const formatShortcut = (combo: string): string => {
  if (!combo) return '';
  const isMac = isMacOS();

  if (isMac) {
    const parts = combo.toLowerCase().split('+');
    let result = '';

    // macOS 표준 기호 순서: ⌃ (Control) -> ⌥ (Option) -> ⇧ (Shift) -> ⌘ (Command)
    if (parts.includes('control')) {
      result += '⌃';
    }
    if (parts.includes('alt') || parts.includes('opt') || parts.includes('option')) {
      result += '⌥';
    }
    if (parts.includes('shift')) {
      result += '⇧';
    }
    if (parts.includes('ctrl') || parts.includes('cmd') || parts.includes('meta') || parts.includes('command')) {
      result += '⌘';
    }

    const modifiers = ['ctrl', 'cmd', 'meta', 'command', 'alt', 'opt', 'option', 'shift', 'control'];
    const mainKeys = parts.filter(p => !modifiers.includes(p));
    const keyStr = mainKeys
      .map(k => {
        if (k === 'enter') return '↩';
        if (k === 'backspace') return '⌫';
        if (k === 'delete') return '⌦';
        if (k === 'arrowup' || k === 'up') return '↑';
        if (k === 'arrowdown' || k === 'down') return '↓';
        if (k === 'arrowleft' || k === 'left') return '←';
        if (k === 'arrowright' || k === 'right') return '→';
        return k.toUpperCase();
      })
      .join('');

    return result + keyStr;
  } else {
    return combo
      .split('+')
      .map(k => {
        const l = k.toLowerCase();
        if (l === 'ctrl' || l === 'cmd' || l === 'meta' || l === 'command') return 'Ctrl';
        if (l === 'alt' || l === 'opt' || l === 'option') return 'Alt';
        if (l === 'shift') return 'Shift';
        if (l === 'control') return 'Ctrl';
        return k.charAt(0).toUpperCase() + k.slice(1);
      })
      .join('+');
  }
};

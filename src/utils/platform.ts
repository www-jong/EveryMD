// OS 플랫폼 감지 유틸리티

export const isMacOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as any)?.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /mac/i.test(platform);
};

export const isWindows = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as any)?.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /win/i.test(platform);
};

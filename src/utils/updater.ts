import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

export type UpdateCheckResult =
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; currentVersion: string; newVersion: string; notes: string | null };

let pendingUpdate: Update | null = null;

export async function getCurrentVersion(): Promise<string> {
  return getVersion();
}

/**
 * GitHub Releases(latest.json)에서 최신 버전을 확인한다.
 * 개발 모드(tauri dev)나 네트워크 오류 시 예외를 그대로 던진다.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = await getCurrentVersion();
  const update = await check();

  if (!update || !update.available) {
    pendingUpdate = null;
    return { status: 'up-to-date', currentVersion };
  }

  pendingUpdate = update;
  const newVersion = update.version ?? currentVersion;
  let notes: string | null = update.body ?? null;
  if (notes) {
    // 마크다운 이미지/링크 태그는 다이얼로그에서 지저분해 보므로 텍스트만 남긴다
    notes = notes.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
  }

  return { status: 'available', currentVersion, newVersion, notes };
}

/** 다운로드 → 설치까지 진행. 완료 후 restartApp() 호출 필요 */
export async function downloadAndInstall(
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  if (!pendingUpdate) throw new Error('확인된 업데이트가 없습니다. 먼저 업데이트를 확인해 주세요.');

  let total: number | null = null;
  let downloaded = 0;

  await pendingUpdate.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? null;
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress({ downloaded, total });
        break;
      case 'Finished':
        onProgress({ downloaded: total ?? downloaded, total });
        break;
    }
  });

  pendingUpdate = null;
}

export async function restartApp(): Promise<void> {
  await relaunch();
}

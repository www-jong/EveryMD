import React, { useEffect, useState } from 'react';
import {
  checkForUpdate,
  downloadAndInstall,
  restartApp,
  getCurrentVersion,
  type DownloadProgress
} from '../../utils/updater';
import './UpdateSection.css';

type UpdateState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export const UpdateSection: React.FC = () => {
  const [state, setState] = useState<UpdateState>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [newVersion, setNewVersion] = useState<string>('');
  const [notes, setNotes] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [progress, setProgress] = useState<DownloadProgress>({ downloaded: 0, total: null });

  useEffect(() => {
    getCurrentVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion('-'));
  }, []);

  const handleCheck = async () => {
    setState('checking');
    setErrorMessage('');
    try {
      const result = await checkForUpdate();
      if (result.status === 'available') {
        setNewVersion(result.newVersion);
        setNotes(result.notes || null);
        setState('available');
      } else {
        setState('up-to-date');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  };

  const handleInstall = async () => {
    setState('downloading');
    setProgress({ downloaded: 0, total: null });
    try {
      await downloadAndInstall(setProgress);
      setState('ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  };

  const percent =
    progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null;

  return (
    <div className="setting-row update-section">
      <div className="setting-info">
        <span className="setting-label">앱 업데이트</span>
        <span className="setting-desc">
          현재 버전 {currentVersion ? `v${currentVersion}` : '-'}
          {state === 'checking' && ' · 업데이트 확인 중...'}
          {state === 'up-to-date' && ' · 최신 버전을 사용 중입니다.'}
          {state === 'available' && ` · 새 버전 v${newVersion} 사용 가능`}
          {state === 'downloading' && ' · 업데이트 다운로드 중...'}
          {state === 'ready' && ' · 설치 완료! 앱을 재시작하면 적용됩니다.'}
        </span>

        {state === 'available' && notes && (
          <pre className="update-notes">{notes}</pre>
        )}

        {state === 'downloading' && percent !== null && (
          <div className="update-progress-bar">
            <div className="update-progress-fill" style={{ width: `${percent}%` }} />
            <span className="update-progress-text">{percent}%</span>
          </div>
        )}

        {state === 'error' && (
          <span className="update-error">업데이트 확인 실패: {errorMessage}</span>
        )}
      </div>

      <div className="setting-control">
        {(state === 'idle' || state === 'error' || state === 'up-to-date') && (
          <button className="update-btn" onClick={handleCheck}>
            업데이트 확인
          </button>
        )}
        {state === 'available' && (
          <button className="update-btn primary" onClick={handleInstall}>
            지금 업데이트
          </button>
        )}
        {state === 'ready' && (
          <button className="update-btn primary" onClick={restartApp}>
            재시작
          </button>
        )}
      </div>
    </div>
  );
};

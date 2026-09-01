import React, { useState, useCallback } from 'react';
import { Tab } from '../../types';
import { writeFile, saveFileDialog } from '../../utils/fileSystem';
import { useFileStore } from '../../stores/fileStore';
import './UnsavedFilesModal.css';

interface UnsavedFilesModalProps {
  /** 미저장 탭 목록. 빈 배열이면 모달 미표시. */
  dirtyTabs: Tab[];
  /** 저장/건너뜀 처리를 마친 뒤 종료를 확정할 콜백 */
  onConfirmClose: () => void;
  /** 닫기 취소 콜백 */
  onCancel: () => void;
}

export const UnsavedFilesModal: React.FC<UnsavedFilesModalProps> = ({
  dirtyTabs,
  onConfirmClose,
  onCancel,
}) => {
  const markSaved = useFileStore((state) => state.markSaved);

  // 현재 처리 중인 탭 인덱스
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const total = dirtyTabs.length;
  const currentTab = dirtyTabs[currentIndex] ?? null;

  // ── 단일 파일 저장 헬퍼 ─────────────────────────────────────
  const saveTab = useCallback(async (tab: Tab): Promise<boolean> => {
    try {
      let pathToSave = tab.filePath;
      if (!pathToSave) {
        // 임시 파일 → Save As 다이얼로그
        const chosen = await saveFileDialog(tab.title);
        if (!chosen) return false; // 사용자가 다이얼로그 취소 → 건너뜀 처리
        pathToSave = chosen;
      }
      await writeFile(pathToSave, tab.content);
      markSaved(tab.id, pathToSave, tab.content);
      return true;
    } catch (err) {
      console.error('[UnsavedFilesModal] 저장 실패:', err);
      return false;
    }
  }, [markSaved]);

  // ── 현재 파일 저장 후 다음으로 ──────────────────────────────
  const handleSaveCurrent = useCallback(async () => {
    if (!currentTab || isSaving) return;
    setIsSaving(true);
    await saveTab(currentTab);
    setIsSaving(false);

    const next = currentIndex + 1;
    if (next >= total) {
      onConfirmClose();
    } else {
      setCurrentIndex(next);
    }
  }, [currentTab, currentIndex, total, isSaving, saveTab, onConfirmClose]);

  // ── 현재 파일 건너뜀(폐기) ──────────────────────────────────
  const handleSkipCurrent = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= total) {
      onConfirmClose();
    } else {
      setCurrentIndex(next);
    }
  }, [currentIndex, total, onConfirmClose]);

  // ── 나머지 전부 저장 ─────────────────────────────────────────
  const handleSaveAll = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const remaining = dirtyTabs.slice(currentIndex);
    for (const tab of remaining) {
      await saveTab(tab);
    }
    setIsSaving(false);
    onConfirmClose();
  }, [dirtyTabs, currentIndex, isSaving, saveTab, onConfirmClose]);

  // ── 나머지 전부 폐기 후 종료 ─────────────────────────────────
  const handleDiscardAll = useCallback(() => {
    onConfirmClose();
  }, [onConfirmClose]);

  if (!currentTab) return null;

  const isNewFile = !currentTab.filePath;
  const progressPercent = total > 1 ? (currentIndex / total) * 100 : 0;

  return (
    <div className="unsaved-modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="unsaved-modal-dialog">

        {/* 헤더 */}
        <div className="unsaved-modal-header">
          <span className="unsaved-modal-header-icon">💾</span>
          <div className="unsaved-modal-header-text">
            <p className="unsaved-modal-title">저장되지 않은 파일이 있습니다</p>
            <p className="unsaved-modal-subtitle">
              닫기 전에 각 파일을 저장할지 선택하세요.
            </p>
          </div>
        </div>

        {/* 본문 */}
        <div className="unsaved-modal-body">

          {/* 진행 표시 (2개 이상일 때만) */}
          {total > 1 && (
            <div className="unsaved-progress">
              <span>{currentIndex + 1} / {total}</span>
              <div className="unsaved-progress-bar-track">
                <div
                  className="unsaved-progress-bar-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* 현재 파일 카드 */}
          <div className="unsaved-file-card">
            <div className="unsaved-file-card-header">
              <span className="unsaved-file-icon">📄</span>
              <div className="unsaved-file-info">
                <div className="unsaved-file-name">{currentTab.title}</div>
                {currentTab.filePath ? (
                  <div className="unsaved-file-path">{currentTab.filePath}</div>
                ) : (
                  <div className="unsaved-file-path">저장된 경로 없음</div>
                )}
              </div>
              <span className={`unsaved-file-badge ${isNewFile ? 'new-file' : 'modified'}`}>
                {isNewFile ? '새 파일' : '수정됨'}
              </span>
            </div>

            {isNewFile && (
              <p className="unsaved-file-hint">
                💡 저장 시 위치와 파일명을 지정해야 합니다.
              </p>
            )}

            <div className="unsaved-file-actions">
              <button
                className="unsaved-btn-save"
                onClick={handleSaveCurrent}
                disabled={isSaving}
              >
                {isSaving ? '저장 중...' : isNewFile ? '저장 위치 지정...' : '저장'}
              </button>
              <button
                className="unsaved-btn-skip"
                onClick={handleSkipCurrent}
                disabled={isSaving}
              >
                이 파일 건너뜀
              </button>
            </div>
          </div>

        </div>

        {/* 하단 일괄 버튼 */}
        <div className="unsaved-modal-footer">
          <button className="unsaved-btn-cancel" onClick={onCancel}>
            취소
          </button>
          <div className="unsaved-footer-spacer" />
          {/* 나머지가 2개 이상일 때만 일괄 버튼 표시 */}
          {total - currentIndex > 1 && (
            <>
              <button
                className="unsaved-btn-discard-all"
                onClick={handleDiscardAll}
                disabled={isSaving}
              >
                나머지 모두 저장 안 함
              </button>
              <button
                className="unsaved-btn-all-save"
                onClick={handleSaveAll}
                disabled={isSaving}
              >
                나머지 모두 저장
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

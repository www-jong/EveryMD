import React, { useState, useMemo } from 'react';
import { FileConflictInfo } from '../../types';
import { useFileStore } from '../../stores/fileStore';
import { writeFile, saveFileDialog } from '../../utils/fileSystem';
import { computeLineDiff, DiffLine } from '../../utils/diff';
import './ConflictModal.css';

interface ConflictModalProps {
  conflict: FileConflictInfo | null;
  onClose: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({ conflict, onClose }) => {
  const reloadTabFromDisk = useFileStore((state) => state.reloadTabFromDisk);
  const markSaved = useFileStore((state) => state.markSaved);
  const [showDiff, setShowDiff] = useState(true); // 기본적으로 diff 열어둠
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified');

  // Git diff 라인 목록 계산 (내용 vs 디스크 내용)
  const diffLines = useMemo<DiffLine[]>(() => {
    if (!conflict) return [];
    return computeLineDiff(conflict.localContent, conflict.diskContent);
  }, [conflict]);

  if (!conflict) return null;

  // 1. 디스크에서 다시 불러오기 (내 수정 내용 버리고 디스크 내용 적용)
  const handleReload = () => {
    reloadTabFromDisk(conflict.tabId, conflict.diskContent);
    onClose();
  };

  // 2. 내 변경사항으로 디스크 덮어쓰기 (외부 변경사항 무시)
  const handleOverwrite = async () => {
    try {
      await writeFile(conflict.filePath, conflict.localContent);
      markSaved(conflict.tabId, conflict.filePath, conflict.localContent);
      onClose();
    } catch (e) {
      console.error('파일 덮어쓰기 실패:', e);
      alert('파일 덮어쓰기에 실패했습니다.');
    }
  };

  // 3. 다른 이름으로 저장 (내 변경사항을 사본으로 보존)
  const handleSaveAs = async () => {
    try {
      const defaultName = conflict.title.replace(/\.md$/i, '_copy.md');
      const newPath = await saveFileDialog(defaultName);
      if (!newPath) return;

      await writeFile(newPath, conflict.localContent);
      reloadTabFromDisk(conflict.tabId, conflict.diskContent);
      useFileStore.getState().openFile(newPath, conflict.localContent);
      onClose();
    } catch (e) {
      console.error('사본 저장 실패:', e);
      alert('사본 파일 저장에 실패했습니다.');
    }
  };

  return (
    <div className="conflict-modal-overlay" onClick={onClose}>
      <div
        className={`conflict-modal-dialog ${showDiff ? 'with-diff' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="conflict-modal-header">
          <div className="conflict-header-title">
            <span className="conflict-icon">⚠️</span>
            <h3>파일 충돌 발생 (외부 수정 감지)</h3>
          </div>
          <button className="conflict-close-btn" onClick={onClose} title="닫기">
            ✕
          </button>
        </div>

        <div className="conflict-modal-body">
          <p className="conflict-description">
            <strong className="conflict-filename">'{conflict.title}'</strong> 파일의 동일한 위치가 외부 프로그램(VS Code, Git 등)과 EveryMD에서 동시에 수정되었습니다.
          </p>

          <div className="conflict-actions-list">
            <button className="conflict-action-btn reload" onClick={handleReload}>
              <div className="action-main">
                <span className="action-icon">🔄</span>
                <span className="action-title">디스크에서 다시 불러오기</span>
              </div>
              <span className="action-desc">내 수정을 취소하고 외부에서 수정한 디스크 최신 내용으로 덮어씁니다.</span>
            </button>

            <button className="conflict-action-btn overwrite" onClick={handleOverwrite}>
              <div className="action-main">
                <span className="action-icon">💾</span>
                <span className="action-title">내 변경사항으로 덮어쓰기</span>
              </div>
              <span className="action-desc">외부 수정을 무시하고 현재 작성한 내용을 디스크에 강제 저장합니다.</span>
            </button>

            <button className="conflict-action-btn save-as" onClick={handleSaveAs}>
              <div className="action-main">
                <span className="action-icon">📝</span>
                <span className="action-title">다른 이름으로 저장</span>
              </div>
              <span className="action-desc">현재 편집 내용을 사본 파일로 보존하고 디스크 원본을 불러옵니다.</span>
            </button>
          </div>

          {/* Diff 헤더 및 모드 전환 */}
          <div className="conflict-diff-toolbar">
            <div className="diff-title-wrap">
              <span className="diff-badge">Git Diff</span>
              <span className="diff-legend-del">- 내 내용 (로컬)</span>
              <span className="diff-legend-add">+ 디스크 내용 (외부)</span>
            </div>
            <div className="diff-view-buttons">
              <button
                className={`diff-mode-btn ${diffMode === 'unified' ? 'active' : ''}`}
                onClick={() => setDiffMode('unified')}
              >
                통합 비교
              </button>
              <button
                className={`diff-mode-btn ${diffMode === 'split' ? 'active' : ''}`}
                onClick={() => setDiffMode('split')}
              >
                나란히 비교
              </button>
              <button
                className="diff-collapse-btn"
                onClick={() => setShowDiff(!showDiff)}
              >
                {showDiff ? '접기 ▲' : '비교 펼치기 ▼'}
              </button>
            </div>
          </div>

          {/* Git Diff 시각화 뷰어 */}
          {showDiff && (
            <div className="conflict-diff-wrapper">
              {diffMode === 'unified' ? (
                <div className="diff-unified-viewer">
                  {diffLines.map((line, idx) => (
                    <div key={idx} className={`diff-line-row diff-${line.type}`}>
                      <span className="diff-gutter diff-gutter-old">
                        {line.oldLineNumber ?? ''}
                      </span>
                      <span className="diff-gutter diff-gutter-new">
                        {line.newLineNumber ?? ''}
                      </span>
                      <span className="diff-marker">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="diff-code-text">{line.content || ' '}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="diff-split-viewer">
                  <div className="split-pane local-pane">
                    <div className="split-pane-header">내 편집 내용 (EveryMD 로컬)</div>
                    <div className="split-pane-body">
                      {conflict.localContent.split(/\r?\n/).map((line, idx) => (
                        <div key={idx} className="split-line-row">
                          <span className="split-gutter">{idx + 1}</span>
                          <span className="split-text">{line || ' '}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="split-pane disk-pane">
                    <div className="split-pane-header">외부 변경 내용 (디스크 원격)</div>
                    <div className="split-pane-body">
                      {conflict.diskContent.split(/\r?\n/).map((line, idx) => (
                        <div key={idx} className="split-line-row">
                          <span className="split-gutter">{idx + 1}</span>
                          <span className="split-text">{line || ' '}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

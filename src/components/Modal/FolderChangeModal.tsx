import React from 'react';
import './FolderChangeModal.css';

interface FolderChangeModalProps {
  isOpen: boolean;
  pendingFolderPath: string | null;
  tabCount: number;
  onCloseAndOpen: () => void;
  onKeepAndOpen: () => void;
  onCancel: () => void;
}

export const FolderChangeModal: React.FC<FolderChangeModalProps> = ({
  isOpen,
  pendingFolderPath,
  tabCount,
  onCloseAndOpen,
  onKeepAndOpen,
  onCancel,
}) => {
  if (!isOpen || !pendingFolderPath) return null;

  const folderName = pendingFolderPath.split(/[/\\]/).filter(Boolean).pop() || pendingFolderPath;

  return (
    <div className="modal-overlay folder-change-overlay">
      <div className="modal-content folder-change-modal" onClick={(e) => e.stopPropagation()}>
        <div className="folder-change-header">
          <div className="folder-change-title-row">
            <span className="folder-change-icon">📁</span>
            <h3>작업 폴더 열기</h3>
          </div>
        </div>

        <div className="folder-change-body">
          <p className="folder-change-desc">
            새 폴더 <strong>[{folderName}]</strong>(으)로 작업 공간을 전환합니다.
          </p>
          <p className="folder-change-subdesc">
            현재 열려 있는 <strong>{tabCount}개</strong>의 탭을 어떻게 처리하시겠습니까?
          </p>
          <div className="folder-path-preview" title={pendingFolderPath}>
            {pendingFolderPath}
          </div>
        </div>

        <div className="folder-change-actions">
          <button className="btn-action cancel" onClick={onCancel}>
            취소
          </button>
          <div className="right-action-group">
            <button className="btn-action keep" onClick={onKeepAndOpen} title="현재 탭을 닫지 않고 새 폴더만 엽니다">
              현재 탭 유지
            </button>
            <button className="btn-action close-all" onClick={onCloseAndOpen} title="열린 탭을 모두 닫고 새 폴더를 엽니다">
              열린 탭 모두 닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

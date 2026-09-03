import React, { useState, useEffect, useRef } from 'react';
import './RenameModal.css';

interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  isDir?: boolean;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

const INVALID_CHARS_REGEX = /[\\/:*?"<>|]/;

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  currentName,
  isDir = false,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);

      // 모달이 열린 후 인풋에 포커스 및 확장자 제외 파일명 자동 선택
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const dotIndex = isDir ? -1 : currentName.lastIndexOf('.');
          if (dotIndex > 0) {
            inputRef.current.setSelectionRange(0, dotIndex);
          } else {
            inputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isOpen, currentName, isDir]);

  if (!isOpen) return null;

  const validate = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setError('이름을 입력해 주세요.');
      return false;
    }
    if (INVALID_CHARS_REGEX.test(trimmed)) {
      setError('특수문자(\\ / : * ? " < > |)는 사용할 수 없습니다.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    validate(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!validate(trimmed)) return;
    if (trimmed === currentName) {
      onCancel();
      return;
    }
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  const isChanged = name.trim() !== '' && name.trim() !== currentName && !error;

  return (
    <div className="rename-modal-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="rename-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="rename-modal-header">
          <div className="rename-modal-title-row">
            <span className="rename-modal-icon">{isDir ? '📁' : '📝'}</span>
            <h3>{isDir ? '폴더 이름 변경' : '파일 이름 변경'}</h3>
          </div>
          <button className="rename-modal-close" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="rename-modal-form">
          <div className="rename-modal-field">
            <label>
              새로운 {isDir ? '폴더명' : '파일명'}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={handleChange}
              placeholder={isDir ? '폴더 이름' : '파일 이름 (예: README.md)'}
              className={error ? 'has-error' : ''}
              required
            />
            {error && <span className="rename-error-text">{error}</span>}
          </div>

          <div className="rename-modal-actions">
            <button type="button" className="rename-modal-btn cancel" onClick={onCancel}>
              취소
            </button>
            <button type="submit" className="rename-modal-btn confirm" disabled={!isChanged}>
              변경
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

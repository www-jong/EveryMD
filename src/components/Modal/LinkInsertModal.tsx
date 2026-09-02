import React, { useState, useEffect, useRef } from 'react';
import './LinkInsertModal.css';

interface LinkInsertModalProps {
  isOpen: boolean;
  initialText?: string;
  initialUrl?: string;
  onConfirm: (text: string, url: string) => void;
  onCancel: () => void;
}

export const LinkInsertModal: React.FC<LinkInsertModalProps> = ({
  isOpen,
  initialText = '',
  initialUrl = '',
  onConfirm,
  onCancel,
}) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl || 'https://');
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setUrl(initialUrl || 'https://');
      setTimeout(() => {
        if (!initialText && textInputRef.current) {
          textInputRef.current.focus();
        } else {
          textInputRef.current?.focus();
          textInputRef.current?.select();
        }
      }, 50);
    }
  }, [isOpen, initialText, initialUrl]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onConfirm(text.trim() || url.trim(), url.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="link-modal-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="link-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="link-modal-header">
          <h3>🔗 링크 삽입</h3>
          <button className="link-modal-close" onClick={onCancel}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="link-modal-form">
          <div className="link-modal-field">
            <label>링크 텍스트</label>
            <input
              ref={textInputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="화면에 표시될 텍스트"
            />
          </div>
          <div className="link-modal-field">
            <label>연결 URL <span className="required">*</span></label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              required
            />
          </div>
          <div className="link-modal-actions">
            <button type="button" className="link-modal-btn cancel" onClick={onCancel}>
              취소
            </button>
            <button type="submit" className="link-modal-btn confirm">
              삽입
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

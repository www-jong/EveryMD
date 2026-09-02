import React, { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import './ImageInsertModal.css';

interface ImageInsertModalProps {
  isOpen: boolean;
  onConfirm: (src: string, alt: string) => void;
  onCancel: () => void;
}

export const ImageInsertModal: React.FC<ImageInsertModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [src, setSrc] = useState('');
  const [previewSrc, setPreviewSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [activeTab, setActiveTab] = useState<'local' | 'web'>('local');
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSrc('');
      setPreviewSrc('');
      setAlt('');
      setActiveTab('local');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBrowseFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Image Files',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        const assetUrl = convertFileSrc(selected);
        setSrc(selected);
        setPreviewSrc(assetUrl);
        if (!alt) {
          const fileName = selected.split(/[/\\]/).pop()?.split('.')[0] || '이미지';
          setAlt(fileName);
        }
      }
    } catch (err) {
      console.error('로컬 이미지 선택 실패:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!src.trim()) return;
    onConfirm(src.trim(), alt.trim() || '이미지');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="image-modal-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-modal-header">
          <h3>🖼️ 이미지 삽입</h3>
          <button className="image-modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="image-modal-tabs">
          <button 
            type="button" 
            className={`image-tab-btn ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
          >
            💻 내 컴퓨터 파일
          </button>
          <button 
            type="button" 
            className={`image-tab-btn ${activeTab === 'web' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('web');
              setTimeout(() => urlInputRef.current?.focus(), 50);
            }}
          >
            🌐 웹 URL
          </button>
        </div>

        <form onSubmit={handleSubmit} className="image-modal-form">
          {activeTab === 'local' ? (
            <div className="image-modal-field">
              <label>로컬 이미지 선택 <span className="required">*</span></label>
              <div className="image-file-picker-row">
                <input
                  type="text"
                  value={src}
                  onChange={(e) => setSrc(e.target.value)}
                  placeholder="이미지 파일 경로"
                  readOnly
                  className="file-path-input"
                />
                <button type="button" className="btn-browse-file" onClick={handleBrowseFile}>
                  📁 찾아보기...
                </button>
              </div>
            </div>
          ) : (
            <div className="image-modal-field">
              <label>웹 이미지 URL <span className="required">*</span></label>
              <input
                ref={urlInputRef}
                type="text"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                placeholder="https://example.com/image.png"
                required
              />
            </div>
          )}

          <div className="image-modal-field">
            <label>이미지 설명 (Alt 텍스트)</label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="이미지에 대한 설명 (선택사항)"
            />
          </div>

          {(previewSrc || (activeTab === 'web' && src.trim())) && (
            <div className="image-preview-container">
              <span className="preview-label">미리보기</span>
              <div className="image-preview-box">
                <img 
                  src={activeTab === 'local' ? previewSrc : src.trim()} 
                  alt={alt || '미리보기'} 
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          <div className="image-modal-actions">
            <button type="button" className="image-modal-btn cancel" onClick={onCancel}>
              취소
            </button>
            <button type="submit" className="image-modal-btn confirm" disabled={!src.trim()}>
              삽입
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

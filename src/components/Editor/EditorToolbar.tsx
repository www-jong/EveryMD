import React from 'react';
import './EditorToolbar.css';

export interface ActiveFormatState {
  headingLevel: 1 | 2 | 3 | null;
  isBold: boolean;
  isItalic: boolean;
  isStrike: boolean;
  isInlineCode: boolean;
  isLink: boolean;
  isBlockquote: boolean;
  isCodeBlock: boolean;
  isMath: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
}

interface EditorToolbarProps {
  activeFormats: ActiveFormatState;
  onSetHeading: (level: 1 | 2 | 3) => void;
  onToggleMark: (mark: 'bold' | 'italic' | 'strike' | 'code') => void;
  onToggleBlock: (block: 'blockquote' | 'bullet_list' | 'ordered_list' | 'task_list') => void;
  onInsertStructure: (structure: 'code_block' | 'math' | 'hr' | 'table' | 'link' | 'image') => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
  activeFormats,
  onSetHeading,
  onToggleMark,
  onToggleBlock,
  onInsertStructure,
}) => {
  return (
    <div className="editor-toolbar">
      {/* 제목 그룹 */}
      <button 
        className={`toolbar-btn ${activeFormats.headingLevel === 1 ? 'active' : ''}`} 
        onClick={() => onSetHeading(1)} 
        title="대제목 (H1)"
      >
        H1
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.headingLevel === 2 ? 'active' : ''}`} 
        onClick={() => onSetHeading(2)} 
        title="중제목 (H2)"
      >
        H2
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.headingLevel === 3 ? 'active' : ''}`} 
        onClick={() => onSetHeading(3)} 
        title="소제목 (H3)"
      >
        H3
      </button>

      <div className="toolbar-divider" />

      {/* 인라인 서식 그룹 */}
      <button 
        className={`toolbar-btn bold ${activeFormats.isBold ? 'active' : ''}`} 
        onClick={() => onToggleMark('bold')} 
        title="굵게 (Bold, Ctrl+B)"
      >
        B
      </button>
      <button 
        className={`toolbar-btn italic ${activeFormats.isItalic ? 'active' : ''}`} 
        onClick={() => onToggleMark('italic')} 
        title="기울임 (Italic, Ctrl+I)"
      >
        I
      </button>
      <button 
        className={`toolbar-btn strikethrough ${activeFormats.isStrike ? 'active' : ''}`} 
        onClick={() => onToggleMark('strike')} 
        title="취소선 (Strikethrough)"
      >
        S
      </button>
      <button 
        className={`toolbar-btn mono-code ${activeFormats.isInlineCode ? 'active' : ''}`} 
        onClick={() => onToggleMark('code')} 
        title="인라인 코드 (`코드`)"
      >
        `c`
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.isLink ? 'active' : ''}`} 
        onClick={() => onInsertStructure('link')} 
        title="링크 삽입"
      >
        🔗
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertStructure('image')} 
        title="이미지 삽입"
      >
        🖼
      </button>

      <div className="toolbar-divider" />

      {/* 블록 서식 그룹 */}
      <button 
        className={`toolbar-btn ${activeFormats.isBlockquote ? 'active' : ''}`} 
        onClick={() => onToggleBlock('blockquote')} 
        title="인용구 (Blockquote)"
      >
        "
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.isCodeBlock ? 'active' : ''}`} 
        onClick={() => onInsertStructure('code_block')} 
        title="코드 블록 (Code Block)"
      >
        &lt;/&gt;
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.isMath ? 'active' : ''}`} 
        onClick={() => onInsertStructure('math')} 
        title="수식 블록 (LaTeX Math)"
      >
        ∑
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertStructure('hr')} 
        title="구분선 (Horizontal Rule)"
      >
        ―
      </button>

      <div className="toolbar-divider" />

      {/* 목록 및 구조 그룹 */}
      <button 
        className={`toolbar-btn ${activeFormats.isBulletList ? 'active' : ''}`} 
        onClick={() => onToggleBlock('bullet_list')} 
        title="글머리 기호 목록"
      >
        •
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.isOrderedList ? 'active' : ''}`} 
        onClick={() => onToggleBlock('ordered_list')} 
        title="번호 매기기 목록"
      >
        1.
      </button>
      <button 
        className={`toolbar-btn ${activeFormats.isTaskList ? 'active' : ''}`} 
        onClick={() => onToggleBlock('task_list')} 
        title="할 일 목록 (Checklist)"
      >
        {activeFormats.isTaskList ? '☑' : '☐'}
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertStructure('table')} 
        title="표 삽입 (Table)"
      >
        田
      </button>
    </div>
  );
};



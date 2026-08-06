import React from 'react';
import './EditorToolbar.css';

interface EditorToolbarProps {
  onInsertMarkdown: (prefix: string, suffix?: string) => void;
  onSetHeading: (level: 1 | 2 | 3) => void;
  onInsertCodeBlock: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onInsertMarkdown, onSetHeading, onInsertCodeBlock }) => {
  return (
    <div className="editor-toolbar">
      <button 
        className="toolbar-btn" 
        onClick={() => onSetHeading(1)} 
        title="현재 줄을 대제목(H1)으로 변환"
      >
        H1
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onSetHeading(2)} 
        title="현재 줄을 중제목(H2)으로 변환"
      >
        H2
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onSetHeading(3)} 
        title="현재 줄을 소제목(H3)으로 변환"
      >
        H3
      </button>
      <div className="toolbar-divider" />
      <button 
        className="toolbar-btn bold" 
        onClick={() => onInsertMarkdown('**', '**')} 
        title="굵게 (Ctrl+B)"
      >
        B
      </button>
      <button 
        className="toolbar-btn italic" 
        onClick={() => onInsertMarkdown('*', '*')} 
        title="기울임 (Ctrl+I)"
      >
        I
      </button>
      <button 
        className="toolbar-btn strikethrough" 
        onClick={() => onInsertMarkdown('~~', '~~')} 
        title="취소선"
      >
        S
      </button>
      <div className="toolbar-divider" />
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertMarkdown('> ', '')} 
        title="인용구"
      >
        "
      </button>
      <button 
        className="toolbar-btn" 
        onClick={onInsertCodeBlock} 
        title="코드 블록"
      >
        &lt;/&gt;
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertMarkdown('[', '](url)')} 
        title="링크 삽입"
      >
        🔗
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertMarkdown('| 제목 1 | 제목 2 |\n| --- | --- |\n| 내용 1 | 내용 2 |\n', '')} 
        title="표 삽입"
      >
        田
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertMarkdown('- ', '')} 
        title="글머리 기호 목록"
      >
        •
      </button>
      <button 
        className="toolbar-btn" 
        onClick={() => onInsertMarkdown('1. ', '')} 
        title="번호 매기기 목록"
      >
        1.
      </button>
    </div>
  );
};

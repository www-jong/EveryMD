import React, { useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react';
import { EditorToolbar } from './EditorToolbar';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './MarkdownEditor.css';

interface EditorInnerProps {
  content: string;
  onChange: (markdown: string) => void;
}

const EditorInner: React.FC<EditorInnerProps> = ({ content, onChange }) => {
  const editorRef = useRef<Crepe | null>(null);

  useEditor((root) => {
    const crepe = new Crepe({ root, defaultValue: content });
    editorRef.current = crepe;

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) {
          onChange(markdown);
        }
      });
    });

    return crepe;
  }, []);

  return <Milkdown />;
};

interface MarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
  
  const handleInsertMarkdown = (prefix: string, suffix: string = '') => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (!editorEl) return;

    editorEl.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    const textToInsert = prefix + selectedText + suffix;

    const isBlockStructure = prefix.startsWith('|') || prefix.startsWith('```') || prefix.startsWith('> ');

    if (isBlockStructure) {
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', textToInsert);

        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboardData
        });
        
        editorEl.dispatchEvent(pasteEvent);
      } catch (err) {
        console.error('클립보드 이벤트 주입 실패, fallback 실행:', err);
        document.execCommand('insertText', false, textToInsert);
      }
    } else {
      document.execCommand('insertText', false, textToInsert);
    }

    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // 에디터 컨테이너 클릭 시 빈 영역이어도 자동으로 실제 ProseMirror 입력 돔으로 초점 유입
  const handleContainerClick = (e: React.MouseEvent) => {
    // 툴바 버튼을 누르거나 탭 닫기 단추 등을 누른 경우 방지
    const target = e.target as HTMLElement;
    if (target.closest('.editor-toolbar') || target.closest('button')) return;

    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (editorEl && document.activeElement !== editorEl) {
      editorEl.focus();
      
      // 만약 커서 포지션이 흐트러졌다면 커서를 본문 맨 끝이나 기본 위치로 안전하게 맞춰줌
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // 이미 텍스트에 커서가 잡혀 있는 게 아닌 경우에만 갱신
        if (range.startOffset === range.endOffset && range.startOffset === 0 && editorEl.lastChild) {
          try {
            const newRange = document.createRange();
            newRange.selectNodeContents(editorEl.lastChild);
            newRange.collapse(false); // 커서를 본문 끝으로 접기
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch (err) {
            // 브라우저 샌드박스 보안 예외 방지
          }
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <EditorToolbar onInsertMarkdown={handleInsertMarkdown} />
      
      {/* 컨테이너 클릭 바인딩 완료 */}
      <div className="editor-container" onClick={handleContainerClick}>
        <MilkdownProvider>
          <EditorInner content={content} onChange={onChange} />
        </MilkdownProvider>
      </div>
    </div>
  );
};

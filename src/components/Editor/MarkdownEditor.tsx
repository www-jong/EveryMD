import React, { useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react';
import { EditorToolbar } from './EditorToolbar';
import { useSettingsStore } from '../../stores/settingsStore';
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
  const { fontSize, setFontSize } = useSettingsStore();

  // ──────────────────────────────────────────────────
  // 현재 커서가 있는 ProseMirror 블록(줄)의 텍스트를 가져와
  // heading prefix를 교체한 뒤 paste event로 재삽입
  // ──────────────────────────────────────────────────
  const handleSetHeading = (level: 1 | 2 | 3) => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (!editorEl) return;

    editorEl.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // 현재 커서가 있는 블록 노드(p, h1, h2, h3, li 등) 탐색
    let node: Node | null = selection.getRangeAt(0).startContainer;
    // 텍스트 노드이면 부모 엘리먼트로 올라감
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    // ProseMirror 내 블록 수준 요소를 찾을 때까지 올라감
    let blockEl: HTMLElement | null = node as HTMLElement;
    while (blockEl && blockEl !== editorEl) {
      const parent: HTMLElement | null = blockEl.parentElement;
      if (parent === editorEl || (parent && parent.classList.contains('ProseMirror'))) break;
      blockEl = parent;
    }
    if (!blockEl || blockEl === editorEl) return;

    // 현재 블록의 텍스트 전체 선택
    const blockRange = document.createRange();
    blockRange.selectNodeContents(blockEl);
    selection.removeAllRanges();
    selection.addRange(blockRange);

    // 블록 전체 텍스트에서 기존 heading prefix 제거
    const rawText = blockEl.innerText || blockEl.textContent || '';
    const strippedText = rawText.replace(/^#{1,6}\s*/, '');

    // 새 heading prefix 붙이기
    const prefix = '#'.repeat(level) + ' ';
    const newText = prefix + strippedText;

    // paste event로 교체 (ProseMirror가 markdown으로 파싱)
    try {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', newText);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData,
      });
      editorEl.dispatchEvent(pasteEvent);
    } catch {
      document.execCommand('insertText', false, newText);
    }

    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // ──────────────────────────────────────────────────
  // 코드 블록 삽입: 선택 텍스트를 코드블록으로 감싸거나 빈 코드블록 삽입
  // ──────────────────────────────────────────────────
  const handleInsertCodeBlock = () => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (!editorEl) return;

    editorEl.focus();

    const selection = window.getSelection();
    const selectedText = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).toString() : '';
    const codeContent = selectedText ? selectedText : '';
    const textToInsert = '```\n' + codeContent + '\n```';

    try {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', textToInsert);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData,
      });
      editorEl.dispatchEvent(pasteEvent);
    } catch {
      document.execCommand('insertText', false, textToInsert);
    }

    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // ──────────────────────────────────────────────────
  // 인라인 마크다운 삽입 (굵게, 기울임, 링크 등)
  // ──────────────────────────────────────────────────
  const handleInsertMarkdown = (prefix: string, suffix: string = '') => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (!editorEl) return;

    editorEl.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    const textToInsert = prefix + selectedText + suffix;

    // 블록 구조(표, 인용구)는 paste event로
    const isBlockStructure = prefix.startsWith('|') || prefix.startsWith('> ');

    if (isBlockStructure) {
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', textToInsert);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData,
        });
        editorEl.dispatchEvent(pasteEvent);
      } catch {
        document.execCommand('insertText', false, textToInsert);
      }
    } else {
      document.execCommand('insertText', false, textToInsert);
    }

    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Ctrl+스크롤로 에디터 배율(폰트 크기) 조절
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newSize = Math.min(32, Math.max(12, fontSize + delta));
    if (newSize !== fontSize) {
      setFontSize(newSize);
    }
  };

  // 에디터 컨테이너 클릭 시 빈 영역이어도 자동으로 실제 ProseMirror 입력 돔으로 초점 유입
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.editor-toolbar') || target.closest('button')) return;

    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (editorEl && document.activeElement !== editorEl) {
      editorEl.focus();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range.startOffset === range.endOffset && range.startOffset === 0 && editorEl.lastChild) {
          try {
            const newRange = document.createRange();
            newRange.selectNodeContents(editorEl.lastChild);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } catch {
            // 브라우저 샌드박스 보안 예외 방지
          }
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <EditorToolbar
        onInsertMarkdown={handleInsertMarkdown}
        onSetHeading={handleSetHeading}
        onInsertCodeBlock={handleInsertCodeBlock}
      />

      {/* 컨테이너 클릭 바인딩 + Ctrl+스크롤 배율 조절 */}
      <div className="editor-container" onClick={handleContainerClick} onWheel={handleWheel}>
        <MilkdownProvider>
          <EditorInner content={content} onChange={onChange} />
        </MilkdownProvider>
      </div>
    </div>
  );
};

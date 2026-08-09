import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { Crepe } from '@milkdown/crepe';
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react';
import { EditorToolbar } from './EditorToolbar';
import { useSettingsStore } from '../../stores/settingsStore';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './MarkdownEditor.css';

// editorViewCtx는 JS에는 있으나 .d.ts에 export 누락 — 런타임에는 정상 존재
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { editorViewCtx } from '@milkdown/core';

interface EditorInnerProps {
  content: string;
  onChange: (markdown: string) => void;
}

// EditorInner가 외부에 노출할 핸들 타입
export interface EditorInnerHandle {
  applyHeading: (level: 1 | 2 | 3) => void;
  insertCodeBlock: () => void;
}

const EditorInner = forwardRef<EditorInnerHandle, EditorInnerProps>(
  ({ content, onChange }, ref) => {
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

    // ── ProseMirror API를 통한 헤딩 변환 ──────────────────────
    useImperativeHandle(ref, () => ({
      applyHeading: (level: 1 | 2 | 3) => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const { $from } = state.selection;
            const depth = $from.depth;

            const headingType = state.schema.nodes.heading;
            const paragraphType = state.schema.nodes.paragraph;
            if (!headingType || !paragraphType) return;

            const currentNode = $from.node(depth);
            const start = $from.start(depth);
            const end = $from.end(depth);

            // 같은 레벨이면 토글(단락으로 되돌림), 다른 레벨이면 변환
            if (
              currentNode.type === headingType &&
              currentNode.attrs.level === level
            ) {
              dispatch(state.tr.setBlockType(start, end, paragraphType));
            } else {
              dispatch(
                state.tr.setBlockType(start, end, headingType, { level })
              );
            }
          });
        } catch (err) {
          console.error('헤딩 변환 실패:', err);
        }
      },

      insertCodeBlock: () => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const codeBlockType =
              state.schema.nodes.fence ??
              state.schema.nodes.code_block ??
              state.schema.nodes.codeBlock;
            if (!codeBlockType) return;

            // 선택 텍스트가 있으면 그걸 코드블록으로 감싸고, 없으면 빈 코드블록 삽입
            const { from, to } = state.selection;
            const selectedText = state.doc.textBetween(from, to);
            const codeNode = codeBlockType.create({}, selectedText ? state.schema.text(selectedText) : null);
            dispatch(state.tr.replaceSelectionWith(codeNode));
          });
        } catch (err) {
          // fallback: paste event
          const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
          if (!editorEl) return;
          editorEl.focus();
          try {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', '```\n\n```');
            editorEl.dispatchEvent(
              new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
            );
          } catch {
            document.execCommand('insertText', false, '```\n\n```');
          }
        }
      },
    }));

    return <Milkdown />;
  }
);

EditorInner.displayName = 'EditorInner';

// ──────────────────────────────────────────────────────────────

interface MarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
}) => {
  const { fontSize, setFontSize } = useSettingsStore();
  const editorInnerRef = useRef<EditorInnerHandle>(null);

  // ── 인라인 마크다운 삽입 (굵게, 기울임, 링크 등) ───────────
  const handleInsertMarkdown = (prefix: string, suffix: string = '') => {
    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (!editorEl) return;

    editorEl.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.getRangeAt(0).toString();
    const textToInsert = prefix + selectedText + suffix;
    const isBlockStructure = prefix.startsWith('|') || prefix.startsWith('> ');

    if (isBlockStructure) {
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/plain', textToInsert);
        editorEl.dispatchEvent(
          new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData })
        );
      } catch {
        document.execCommand('insertText', false, textToInsert);
      }
    } else {
      document.execCommand('insertText', false, textToInsert);
    }

    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Ctrl+스크롤로 에디터 배율(폰트 크기) 조절
  // CodeMirror 코드블록 위에서는 가로채지 않음 (CM이 자체 핸들링)
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    const target = e.target as HTMLElement;
    if (target.closest('.cm-editor') || target.closest('.cm-scroller')) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newSize = Math.min(32, Math.max(12, fontSize + delta));
    if (newSize !== fontSize) setFontSize(newSize);
  };

  // 에디터 빈 영역 클릭 시 포커스 유입
  // CodeMirror 코드블록 내부 클릭은 절대 가로채지 않음 (입력 불가 버그 방지)
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // CodeMirror 내부: CM이 스스로 포커스 담당
    if (
      target.closest('.cm-editor') ||
      target.closest('.cm-content') ||
      target.closest('.cm-scroller') ||
      target.closest('.cm-gutters')
    ) return;
    if (target.closest('.editor-toolbar') || target.closest('button')) return;

    const editorEl = document.querySelector('.ProseMirror') as HTMLDivElement;
    if (editorEl && document.activeElement !== editorEl) {
      editorEl.focus();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (
          range.startOffset === range.endOffset &&
          range.startOffset === 0 &&
          editorEl.lastChild
        ) {
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
        onSetHeading={(level) => editorInnerRef.current?.applyHeading(level)}
        onInsertCodeBlock={() => editorInnerRef.current?.insertCodeBlock()}
      />

      <div className="editor-container" onClick={handleContainerClick} onWheel={handleWheel}>
        <MilkdownProvider>
          <EditorInner ref={editorInnerRef} content={content} onChange={onChange} />
        </MilkdownProvider>
      </div>
    </div>
  );
};

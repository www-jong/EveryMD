import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Crepe } from '@milkdown/crepe';
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react';
import { EditorToolbar } from './EditorToolbar';
import { useSettingsStore } from '../../stores/settingsStore';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './MarkdownEditor.css';

import { editorViewCtx } from '@milkdown/core';
import { $prose, replaceAll } from '@milkdown/kit/utils';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Plugin, PluginKey, NodeSelection } from '@milkdown/kit/prose/state';
import { dropPoint } from '@milkdown/kit/prose/transform';

interface DraggedBlockInfo {
  pos: number;
  nodeSize: number;
  node: any;
}

let activeDraggedBlock: DraggedBlockInfo | null = null;

// 블록 손잡이(⠿) 드래그 앤 드롭 이동 및 힌트선 표시를 완벽 처리하는 플러그인
const blockDragPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('everymd-block-dnd-manager'),
    props: {
      handleDOMEvents: {
        dragstart: (view, event) => {
          const isFileDrag = event.dataTransfer?.types?.includes('Files');
          if (isFileDrag) return false;

          const sel = view.state.selection;
          if (sel instanceof NodeSelection) {
            activeDraggedBlock = {
              pos: sel.from,
              nodeSize: sel.node.nodeSize,
              node: sel.node,
            };
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = 'move';
            }
          }
          return false;
        },
        dragover: (_view, event) => {
          const isFileDrag = event.dataTransfer?.types?.includes('Files');
          if (!isFileDrag && event.dataTransfer) {
            // macOS WebKit 녹색 '+' 복사 배지 제거 및 이동 모드 활성화
            event.dataTransfer.dropEffect = 'move';
          }
          return false;
        },
        dragend: () => {
          activeDraggedBlock = null;
          return false;
        },
      },
      handleDrop: (view, event, slice) => {
        const isFileDrag = event.dataTransfer?.types?.includes('Files');
        if (isFileDrag) return false;

        const eventPos = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!eventPos) return false;

        const { state, dispatch } = view;
        const targetPos = eventPos.pos;

        if (activeDraggedBlock) {
          const { pos: fromPos, nodeSize, node } = activeDraggedBlock;
          const toPos = fromPos + nodeSize;

          // 드롭 대상이 원래 블록 범위 안인 경우 무시
          if (targetPos >= fromPos && targetPos <= toPos) {
            activeDraggedBlock = null;
            return true;
          }

          // 드롭 삽입 위치 계산
          const insertPoint = dropPoint(state.doc, targetPos, slice) ?? targetPos;

          let tr = state.tr;
          // 1. 원본 블록 삭제
          tr = tr.delete(fromPos, toPos);

          // 2. 삭제 후 드롭 위치 맵핑
          const mappedTarget = tr.mapping.map(insertPoint);

          // 3. 새 위치에 블록 삽입
          tr = tr.insert(mappedTarget, node);

          // 4. 새 위치의 블록 선택
          if (NodeSelection.isSelectable(node)) {
            try {
              tr = tr.setSelection(NodeSelection.create(tr.doc, mappedTarget));
            } catch {
              // fallback
            }
          }

          dispatch(tr.scrollIntoView());
          activeDraggedBlock = null;
          event.preventDefault();
          return true;
        }

        return false;
      },
    },
  });
});

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
    const lastInternalMarkdownRef = useRef(content);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEditor((root) => {
      const crepe = new Crepe({ 
        root, 
        defaultValue: content,
        featureConfigs: {
          [Crepe.Feature.Cursor]: {
            color: 'var(--accent-color, #6366f1)',
            width: 3,
          },
        },
      });
      crepe.editor.use(blockDragPlugin);
      crepe.editor.use(listener);
      crepe.editor.config((ctx) => {
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            lastInternalMarkdownRef.current = markdown;
            onChangeRef.current?.(markdown);
          }
        });
        ctx.get(listenerCtx).updated(() => {
          try {
            const md = crepe.getMarkdown();
            if (md !== lastInternalMarkdownRef.current) {
              lastInternalMarkdownRef.current = md;
              onChangeRef.current?.(md);
            }
          } catch (e) {
            // ignore
          }
        });
      });
      editorRef.current = crepe;
      return crepe;
    }, []);

    // 외부(디스크 리로드/자동 병합)에서 content prop이 변경되었을 때 에디터 화면에 즉시 동기화
    useEffect(() => {
      if (editorRef.current && content !== lastInternalMarkdownRef.current) {
        lastInternalMarkdownRef.current = content;
        try {
          editorRef.current.editor.action(replaceAll(content));
        } catch (err) {
          console.warn('[MarkdownEditor] 외부 변경사항 런타임 동기화 실패:', err);
        }
      }
    }, [content]);

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
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const editorInnerRef = useRef<EditorInnerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  // React onWheel은 passive로 등록되어 preventDefault가 무시되므로
  // 네이티브 리스너({passive:false})를 직접 등록해야 기본 페이지 줌이 막힘
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const target = e.target as HTMLElement;
      // CodeMirror 코드블록 위에서는 가로채지 않음 (CM이 자체 핸들링)
      if (target.closest('.cm-editor') || target.closest('.cm-scroller')) return;
      e.preventDefault();
      e.stopPropagation();
      const current = useSettingsStore.getState().fontSize;
      const delta = e.deltaY > 0 ? -1 : 1;
      const newSize = Math.min(32, Math.max(12, current + delta));
      if (newSize !== current) setFontSize(newSize);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [setFontSize]);

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
      // preventScroll: true — 포커스 시 스크롤 점프 방지
      editorEl.focus({ preventScroll: true });

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

      <div ref={containerRef} className="editor-container" onClick={handleContainerClick}>
        <MilkdownProvider>
          <EditorInner ref={editorInnerRef} content={content} onChange={onChange} />
        </MilkdownProvider>
      </div>
    </div>
  );
};

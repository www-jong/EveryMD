import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Crepe } from '@milkdown/crepe';
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react';
import { EditorToolbar, ActiveFormatState } from './EditorToolbar';
import { useSettingsStore } from '../../stores/settingsStore';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './MarkdownEditor.css';

import { editorViewCtx } from '@milkdown/core';
import { $prose, replaceAll } from '@milkdown/kit/utils';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Plugin, PluginKey, NodeSelection } from '@milkdown/kit/prose/state';
import { dropPoint } from '@milkdown/kit/prose/transform';
import { toggleMark as toggleMarkCmd, wrapIn, lift } from '@milkdown/kit/prose/commands';
import { wrapInList, liftListItem } from '@milkdown/kit/prose/schema-list';
import { convertFileSrc } from '@tauri-apps/api/core';
import { LinkInsertModal } from '../Modal/LinkInsertModal';
import { ImageInsertModal } from '../Modal/ImageInsertModal';

export const defaultActiveFormats: ActiveFormatState = {
  headingLevel: null,
  isBold: false,
  isItalic: false,
  isStrike: false,
  isInlineCode: false,
  isLink: false,
  isBlockquote: false,
  isCodeBlock: false,
  isMath: false,
  isBulletList: false,
  isOrderedList: false,
  isTaskList: false,
};

let formatChangeHandler: ((formats: ActiveFormatState) => void) | null = null;

const computeActiveFormats = (state: any): ActiveFormatState => {
  const { $from, from, to, empty } = state.selection;
  const schema = state.schema;

  let isBold = false;
  let isItalic = false;
  let isStrike = false;
  let isInlineCode = false;
  let isLink = false;
  let isMath = false;

  const strongMark = schema.marks.strong;
  if (strongMark) {
    isBold = empty
      ? Boolean(strongMark.isInSet(state.storedMarks || $from.marks()))
      : state.doc.rangeHasMark(from, to, strongMark);
  }

  const emMark = schema.marks.emphasis || schema.marks.em;
  if (emMark) {
    isItalic = empty
      ? Boolean(emMark.isInSet(state.storedMarks || $from.marks()))
      : state.doc.rangeHasMark(from, to, emMark);
  }

  const strikeMark = schema.marks.strike_through || schema.marks.strike;
  if (strikeMark) {
    isStrike = empty
      ? Boolean(strikeMark.isInSet(state.storedMarks || $from.marks()))
      : state.doc.rangeHasMark(from, to, strikeMark);
  }

  const codeInlineMark = schema.marks.inlineCode || schema.marks.code_inline || schema.marks.code;
  if (codeInlineMark) {
    isInlineCode = empty
      ? Boolean(codeInlineMark.isInSet(state.storedMarks || $from.marks()))
      : state.doc.rangeHasMark(from, to, codeInlineMark);
  }

  const linkMark = schema.marks.link;
  if (linkMark) {
    isLink = empty
      ? Boolean(linkMark.isInSet(state.storedMarks || $from.marks()))
      : state.doc.rangeHasMark(from, to, linkMark);
  }

  let headingLevel: 1 | 2 | 3 | null = null;
  let isBlockquote = false;
  let isCodeBlock = false;
  let isBulletList = false;
  let isOrderedList = false;
  let isTaskList = false;

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    const typeName = node?.type?.name;

    if (typeName === 'heading') {
      const level = node.attrs.level;
      if (level === 1 || level === 2 || level === 3) {
        headingLevel = level;
      }
    }
    if (typeName === 'blockquote') {
      isBlockquote = true;
    }
    if (typeName === 'fence' || typeName === 'code_block' || typeName === 'codeBlock') {
      const lang = (node.attrs.language || '').toLowerCase();
      if (lang === 'latex' || lang === 'math') {
        isMath = true;
      } else {
        isCodeBlock = true;
      }
    }
    if (typeName === 'math_inline') {
      isMath = true;
    }
    if (typeName === 'bullet_list' || typeName === 'bulletList') {
      isBulletList = true;
    }
    if (typeName === 'ordered_list' || typeName === 'orderedList') {
      isOrderedList = true;
    }
    if ((typeName === 'list_item' || typeName === 'listItem') && typeof node.attrs?.checked === 'boolean') {
      isTaskList = true;
    }
  }

  return {
    headingLevel,
    isBold,
    isItalic,
    isStrike,
    isInlineCode,
    isLink,
    isBlockquote,
    isCodeBlock,
    isMath,
    isBulletList,
    isOrderedList,
    isTaskList,
  };
};

// 에디터 서식 실시간 감지 플러그인
const selectionFormatPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('everymd-active-format-tracker'),
    view() {
      return {
        update(view) {
          if (formatChangeHandler) {
            try {
              const formats = computeActiveFormats(view.state);
              formatChangeHandler(formats);
            } catch {
              // ignore
            }
          }
        },
      };
    },
  });
});

interface DraggedBlockInfo {
  pos: number;
  nodeSize: number;
  node: any;
}

let activeDraggedBlock: DraggedBlockInfo | null = null;

// 블록 손잡이(⠿) 및 이미지 등 내부 요소 드래그 앤 드롭 이동을 완벽 처리하는 플러그인
const blockDragPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('everymd-block-dnd-manager'),
    props: {
      handleDOMEvents: {
        dragstart: (view, event) => {
          const target = event.target as HTMLElement;
          const imgEl = target?.closest('img, .milkdown-image-block, .image-inline') as HTMLElement;
          
          const isFileDrag = event.dataTransfer?.types?.includes('Files');
          if (isFileDrag && !imgEl) return false;

          (window as any).__EVERYMD_INTERNAL_DRAGGING__ = true;

          const sel = view.state.selection;
          if (sel instanceof NodeSelection) {
            activeDraggedBlock = {
              pos: sel.from,
              nodeSize: sel.node.nodeSize,
              node: sel.node,
            };
          } else if (imgEl) {
            try {
              const pos = view.posAtDOM(imgEl, 0);
              const node = view.state.doc.nodeAt(pos);
              if (node) {
                activeDraggedBlock = {
                  pos,
                  nodeSize: node.nodeSize,
                  node,
                };
              }
            } catch {
              // fallback
            }
          }

          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            try {
              event.dataTransfer.setData('application/x-everymd-internal-drag', 'true');
            } catch {
              // ignore
            }
          }
          return false;
        },
        dragover: (_view, event) => {
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
          }
          return false;
        },
        dragend: () => {
          activeDraggedBlock = null;
          setTimeout(() => {
            (window as any).__EVERYMD_INTERNAL_DRAGGING__ = false;
          }, 100);
          return false;
        },
      },
      handleDrop: (view, event, slice) => {
        const isInternalDrag = (window as any).__EVERYMD_INTERNAL_DRAGGING__;
        const isFileDrag = event.dataTransfer?.types?.includes('Files');
        if (isFileDrag && !isInternalDrag) return false;

        const eventPos = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!eventPos) {
          (window as any).__EVERYMD_INTERNAL_DRAGGING__ = false;
          return false;
        }

        const { state, dispatch } = view;
        const targetPos = eventPos.pos;

        if (activeDraggedBlock) {
          const { pos: fromPos, nodeSize, node } = activeDraggedBlock;
          const toPos = fromPos + nodeSize;

          // 드롭 대상이 원래 블록 범위 안인 경우 무시
          if (targetPos >= fromPos && targetPos <= toPos) {
            activeDraggedBlock = null;
            (window as any).__EVERYMD_INTERNAL_DRAGGING__ = false;
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
          setTimeout(() => {
            (window as any).__EVERYMD_INTERNAL_DRAGGING__ = false;
          }, 100);
          event.preventDefault();
          event.stopPropagation();
          return true;
        }

        (window as any).__EVERYMD_INTERNAL_DRAGGING__ = false;
        return false;
      },
    },
  });
});

interface EditorInnerProps {
  content: string;
  onChange: (markdown: string) => void;
  onFormatChange: (formats: ActiveFormatState) => void;
}

// EditorInner가 외부에 노출할 핸들 타입
export interface EditorInnerHandle {
  applyHeading: (level: 1 | 2 | 3) => void;
  toggleMark: (markName: 'bold' | 'italic' | 'strike' | 'code') => void;
  toggleBlock: (blockName: 'blockquote' | 'bullet_list' | 'ordered_list' | 'task_list') => void;
  insertStructure: (structure: 'code_block' | 'math' | 'hr' | 'table') => void;
  insertLink: (text: string, url: string) => void;
  insertImage: (src: string, alt: string) => void;
  getSelectedText: () => string;
  saveSelection: () => void;
}

const EditorInner = forwardRef<EditorInnerHandle, EditorInnerProps>(
  ({ content, onChange, onFormatChange }, ref) => {
    const editorRef = useRef<Crepe | null>(null);
    const lastInternalMarkdownRef = useRef(content);
    const onChangeRef = useRef(onChange);
    const savedSelectionRef = useRef<{ from: number; to: number; empty: boolean } | null>(null);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      formatChangeHandler = onFormatChange;
      return () => {
        formatChangeHandler = null;
      };
    }, [onFormatChange]);

    useEditor((root) => {
      const crepe = new Crepe({ 
        root, 
        defaultValue: content,
        featureConfigs: {
          [Crepe.Feature.Cursor]: {
            color: 'var(--accent-color, #6366f1)',
            width: 3,
          },
          [Crepe.Feature.ImageBlock]: {
            proxyDomURL: (url: string) => {
              if (
                url &&
                !url.startsWith('http://') &&
                !url.startsWith('https://') &&
                !url.startsWith('data:') &&
                !url.startsWith('asset:')
              ) {
                try {
                  return convertFileSrc(url);
                } catch {
                  return url;
                }
              }
              return url;
            },
          },
        },
      });
      crepe.editor.use(blockDragPlugin);
      crepe.editor.use(selectionFormatPlugin);
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

    // ── ProseMirror API를 통한 서식 및 블록 제어 ─────────────
    useImperativeHandle(ref, () => ({
      saveSelection: () => {
        const crepe = editorRef.current;
        if (!crepe) return;
        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (view) {
              const { from, to, empty } = view.state.selection;
              savedSelectionRef.current = { from, to, empty };
            }
          });
        } catch {
          // fallback
        }
      },

      getSelectedText: () => {
        const crepe = editorRef.current;
        if (!crepe) return '';
        let selected = '';
        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (view) {
              const { from, to } = view.state.selection;
              selected = view.state.doc.textBetween(from, to);
            }
          });
        } catch {
          // fallback
        }
        return selected;
      },

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
            view.focus();
          });
        } catch (err) {
          console.error('헤딩 변환 실패:', err);
        }
      },

      toggleMark: (markName) => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const schema = state.schema;

            let markType = null;
            if (markName === 'bold') markType = schema.marks.strong;
            if (markName === 'italic') markType = schema.marks.emphasis || schema.marks.em;
            if (markName === 'strike') markType = schema.marks.strike_through || schema.marks.strike;
            if (markName === 'code') markType = schema.marks.inlineCode || schema.marks.code_inline || schema.marks.code;

            if (markType) {
              toggleMarkCmd(markType)(state, dispatch);
              view.focus();
            }
          });
        } catch (err) {
          console.error('마크 토글 실패:', err);
        }
      },

      toggleBlock: (blockName) => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const schema = state.schema;
            const { $from } = state.selection;

            if (blockName === 'blockquote') {
              let inBlockquote = false;
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type === schema.nodes.blockquote) inBlockquote = true;
              }
              if (inBlockquote) {
                lift(state, dispatch);
              } else if (schema.nodes.blockquote) {
                wrapIn(schema.nodes.blockquote)(state, dispatch);
              }
            } else if (blockName === 'bullet_list') {
              let inList = false;
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type === schema.nodes.bullet_list) inList = true;
              }
              if (inList && schema.nodes.list_item) {
                liftListItem(schema.nodes.list_item)(state, dispatch);
              } else if (schema.nodes.bullet_list) {
                wrapInList(schema.nodes.bullet_list)(state, dispatch);
              }
            } else if (blockName === 'ordered_list') {
              let inList = false;
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type === schema.nodes.ordered_list) inList = true;
              }
              if (inList && schema.nodes.list_item) {
                liftListItem(schema.nodes.list_item)(state, dispatch);
              } else if (schema.nodes.ordered_list) {
                wrapInList(schema.nodes.ordered_list)(state, dispatch);
              }
            } else if (blockName === 'task_list') {
              // 1. 표(Table Cell) 내부인지 검사 -> 표 안에서는 [ ] 인라인 체크박스 삽입 (한 셀에 여러 개 삽입 가능)
              let inTableCell = false;
              for (let d = $from.depth; d > 0; d--) {
                const typeName = $from.node(d).type.name;
                if (typeName === 'table_cell' || typeName === 'table_header') {
                  inTableCell = true;
                  break;
                }
              }

              if (inTableCell) {
                dispatch(state.tr.insertText('[ ] '));
                view.focus();
                return;
              }

              // 2. 일반 목록 아이템 안인지 검사
              let itemDepth = -1;
              for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type === schema.nodes.list_item) {
                  itemDepth = d;
                  break;
                }
              }

              if (itemDepth > 0) {
                const itemNode = $from.node(itemDepth);
                const itemPos = $from.before(itemDepth);
                const currentChecked = itemNode.attrs.checked;
                // 체크 토글: null (일반목록) -> false (할일 미완료) -> true (할일 완료) -> null (일반목록)
                const nextChecked = currentChecked === null || currentChecked === undefined ? false : currentChecked === false ? true : null;
                dispatch(state.tr.setNodeMarkup(itemPos, undefined, { ...itemNode.attrs, checked: nextChecked }));
              } else if (schema.nodes.bullet_list && schema.nodes.list_item && schema.nodes.paragraph) {
                // 일반 줄에서 누른 경우: 체크박스 할 일 목록 생성
                const { from, to } = state.selection;
                const selectedText = state.doc.textBetween(from, to);
                const p = schema.nodes.paragraph.create({}, selectedText ? schema.text(selectedText) : null);
                const li = schema.nodes.list_item.create({ checked: false }, p);
                const list = schema.nodes.bullet_list.create({}, li);
                dispatch(state.tr.replaceSelectionWith(list));
              }
            }

            view.focus();
          });
        } catch (err) {
          console.error('블록 토글 실패:', err);
        }
      },

      insertStructure: (structure) => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const schema = state.schema;
            const { from, to } = state.selection;

            if (structure === 'code_block') {
              const codeBlockType = schema.nodes.fence ?? schema.nodes.code_block ?? schema.nodes.codeBlock;
              if (codeBlockType) {
                const selectedText = state.doc.textBetween(from, to);
                const codeNode = codeBlockType.create({}, selectedText ? schema.text(selectedText) : null);
                dispatch(state.tr.replaceSelectionWith(codeNode));
              }
            } else if (structure === 'math') {
              // 콤팩트한 한 줄 크기 인라인 수식 노드 삽입 및 편집 팝업 즉시 자동 오픈
              const mathType = schema.nodes.math_inline;
              if (mathType) {
                const selectedText = state.doc.textBetween(from, to);
                const mathVal = selectedText.trim() || 'x';
                const mathNode = mathType.create({ value: mathVal });
                let tr = state.tr.replaceSelectionWith(mathNode);
                const insertPos = tr.selection.from - mathNode.nodeSize;
                try {
                  tr = tr.setSelection(NodeSelection.create(tr.doc, insertPos));
                } catch {
                  // fallback
                }
                dispatch(tr.scrollIntoView());
              } else {
                const selectedText = state.doc.textBetween(from, to);
                dispatch(state.tr.insertText(`$${selectedText || 'x'}$`, from, to));
              }
            } else if (structure === 'hr') {
              const hrType = schema.nodes.hr || schema.nodes.horizontal_rule;
              if (hrType) {
                const hrNode = hrType.create();
                dispatch(state.tr.replaceSelectionWith(hrNode));
              }
            } else if (structure === 'table') {
              const { table, table_row, table_cell, table_header, paragraph } = schema.nodes;
              if (table && table_row && (table_cell || table_header) && paragraph) {
                const cellType = table_cell || paragraph;
                const headerType = table_header || cellType;
                const createCell = (isHeader: boolean, text: string = '') => {
                  const p = paragraph.create({}, text ? schema.text(text) : null);
                  return (isHeader ? headerType : cellType).create({}, p);
                };
                const headerRow = table_row.create({}, [createCell(true, '열 1'), createCell(true, '열 2'), createCell(true, '열 3')]);
                const dataRow1 = table_row.create({}, [createCell(false, '내용 1'), createCell(false, '내용 2'), createCell(false, '내용 3')]);
                const dataRow2 = table_row.create({}, [createCell(false, ''), createCell(false, ''), createCell(false, '')]);
                const tableNode = table.create({}, [headerRow, dataRow1, dataRow2]);
                dispatch(state.tr.replaceSelectionWith(tableNode));
              }
            }

            view.focus();
          });
        } catch (err) {
          console.error('구조 삽입 실패:', err);
        }
      },

      insertLink: (text: string, url: string) => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const schema = state.schema;
            const linkMarkType = schema.marks.link;
            if (!linkMarkType) return;

            const linkMark = linkMarkType.create({ href: url });
            const targetSel = savedSelectionRef.current || state.selection;
            const { from, to, empty } = targetSel;

            if (!empty && from !== to) {
              dispatch(state.tr.addMark(from, to, linkMark).scrollIntoView());
            } else {
              const textToInsert = text || url;
              const textNode = schema.text(textToInsert, [linkMark]);
              dispatch(state.tr.replaceWith(from, to, textNode).scrollIntoView());
            }
            savedSelectionRef.current = null;
            view.focus();
          });
        } catch (err) {
          console.error('링크 삽입 실패:', err);
        }
      },

      insertImage: (src: string, alt: string) => {
        const crepe = editorRef.current;
        if (!crepe) return;

        try {
          crepe.editor.action((ctx: any) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;

            const { state, dispatch } = view;
            const schema = state.schema;
            const imageType = schema.nodes.image;

            if (imageType) {
              const imgNode = imageType.create({ src, alt: alt || '이미지' });
              const targetSel = savedSelectionRef.current || state.selection;
              const { from, to } = targetSel;
              dispatch(state.tr.replaceWith(from, to, imgNode).scrollIntoView());
            }
            savedSelectionRef.current = null;
            view.focus();
          });
        } catch (err) {
          console.error('이미지 삽입 실패:', err);
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
  const [activeFormats, setActiveFormats] = useState<ActiveFormatState>(defaultActiveFormats);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [initialLinkText, setInitialLinkText] = useState('');

  const editorInnerRef = useRef<EditorInnerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFormatChange = useCallback((formats: ActiveFormatState) => {
    setActiveFormats(formats);
  }, []);

  const handleToggleMark = (mark: 'bold' | 'italic' | 'strike' | 'code') => {
    editorInnerRef.current?.toggleMark(mark);
  };

  const handleToggleBlock = (block: 'blockquote' | 'bullet_list' | 'ordered_list' | 'task_list') => {
    editorInnerRef.current?.toggleBlock(block);
  };

  const handleInsertStructure = (structure: 'code_block' | 'math' | 'hr' | 'table' | 'link' | 'image') => {
    if (structure === 'link') {
      editorInnerRef.current?.saveSelection();
      const selected = editorInnerRef.current?.getSelectedText() || '';
      setInitialLinkText(selected);
      setIsLinkModalOpen(true);
    } else if (structure === 'image') {
      editorInnerRef.current?.saveSelection();
      setIsImageModalOpen(true);
    } else {
      editorInnerRef.current?.insertStructure(structure);
    }
  };

  const handleConfirmLink = (text: string, url: string) => {
    setIsLinkModalOpen(false);
    editorInnerRef.current?.insertLink(text, url);
  };

  const handleConfirmImage = (src: string, alt: string) => {
    setIsImageModalOpen(false);
    editorInnerRef.current?.insertImage(src, alt);
  };

  // Ctrl+스크롤로 에디터 배율(폰트 크기) 조절
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const target = e.target as HTMLElement;
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

  // 수식 팝업 및 내부 툴팁 클릭 시 메인 에디터 포커스 탈취 방지
  const handleContainerMouseDownCapture = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.milkdown-latex-inline-edit') || target.closest('[data-type="math_inline"]')) {
      e.stopPropagation();
    }
  };

  // 에디터 빈 영역 클릭 시 포커스 유입
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.cm-editor') ||
      target.closest('.cm-content') ||
      target.closest('.cm-scroller') ||
      target.closest('.cm-gutters')
    ) return;
    if (
      target.closest('.editor-toolbar') || 
      target.closest('button') || 
      target.closest('.modal-overlay') || 
      target.closest('.milkdown-latex-inline-edit') || 
      target.closest('.milkdown-image-block') ||
      target.closest('[data-type="math_inline"]')
    ) return;

    const editorEl = document.querySelector('.editor-container .milkdown > .ProseMirror') as HTMLDivElement;
    if (editorEl && document.activeElement !== editorEl) {
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <EditorToolbar
        activeFormats={activeFormats}
        onSetHeading={(level) => editorInnerRef.current?.applyHeading(level)}
        onToggleMark={handleToggleMark}
        onToggleBlock={handleToggleBlock}
        onInsertStructure={handleInsertStructure}
      />

      <div 
        ref={containerRef} 
        className="editor-container" 
        onClick={handleContainerClick}
        onMouseDownCapture={handleContainerMouseDownCapture}
      >
        <MilkdownProvider>
          <EditorInner 
            ref={editorInnerRef} 
            content={content} 
            onChange={onChange} 
            onFormatChange={handleFormatChange}
          />
        </MilkdownProvider>
      </div>

      <LinkInsertModal
        isOpen={isLinkModalOpen}
        initialText={initialLinkText}
        onConfirm={handleConfirmLink}
        onCancel={() => setIsLinkModalOpen(false)}
      />

      <ImageInsertModal
        isOpen={isImageModalOpen}
        onConfirm={handleConfirmImage}
        onCancel={() => setIsImageModalOpen(false)}
      />
    </div>
  );
};


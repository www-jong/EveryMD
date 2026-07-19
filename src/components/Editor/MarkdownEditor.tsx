import React, { useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { MilkdownProvider, Milkdown, useEditor } from '@milkdown/react';
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
  }, []); // Empty deps: editor lifecycle managed by key prop in App.tsx

  return <Milkdown />;
};

interface MarkdownEditorProps {
  content: string;
  onChange: (markdown: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
  return (
    <div className="editor-container">
      <MilkdownProvider>
        <EditorInner content={content} onChange={onChange} />
      </MilkdownProvider>
    </div>
  );
};

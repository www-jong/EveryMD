import React, { useState, useCallback } from 'react';
import { openFolderDialog, readDirectory, readFile } from '../../utils/fileSystem';
import { useFileStore } from '../../stores/fileStore';
import { FileEntry } from '../../types';
import './FileExplorer.css';

const FileTreeItem: React.FC<{ entry: FileEntry; onFileClick: (entry: FileEntry) => void }> = ({ entry, onFileClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);

  const handleClick = async () => {
    if (entry.isDir) {
      if (!isOpen && children.length === 0) {
        const entries = await readDirectory(entry.path);
        setChildren(entries);
      }
      setIsOpen(!isOpen);
    } else {
      onFileClick(entry);
    }
  };

  return (
    <div className="file-tree-item">
      <div className="file-tree-row" onClick={handleClick}>
        <span className="file-icon">{entry.isDir ? '📁' : '📄'}</span>
        <span className="file-name">{entry.name}</span>
      </div>
      {entry.isDir && isOpen && (
        <div className="file-tree-children">
          {children.map((child) => (
            <FileTreeItem key={child.path} entry={child} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC = () => {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const openFile = useFileStore((state) => state.openFile);

  const handleOpenFolder = async () => {
    const path = await openFolderDialog();
    if (path) {
      const entries = await readDirectory(path);
      setRootEntries(entries);
    }
  };

  const handleFileClick = useCallback(async (entry: FileEntry) => {
    if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
      try {
        const content = await readFile(entry.path);
        openFile(entry.path, content, entry.name);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  }, [openFile]);

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span>탐색기</span>
        <button onClick={handleOpenFolder} title="폴더 열기">폴더 열기</button>
      </div>
      <div className="file-explorer-content">
        {rootEntries.length === 0 ? (
          <div className="empty-message">폴더를 열어주세요</div>
        ) : (
          rootEntries.map((entry) => (
            <FileTreeItem key={entry.path} entry={entry} onFileClick={handleFileClick} />
          ))
        )}
      </div>
    </div>
  );
};

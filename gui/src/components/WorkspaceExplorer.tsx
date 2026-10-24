import { useState, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FileCode,
  ChevronDown,
  ChevronRight,
  Upload,
  ChevronLeft,
  X,
} from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../api/client';
import { showSessionModel } from '../utils/sessionModel';
import { toErrMsg } from '../utils/errors';

interface WorkspaceFile {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: WorkspaceFile[];
  file?: File;
  handle?: FileSystemFileHandle;
}

async function readDirHandle(
  handle: FileSystemDirectoryHandle,
  currentPath = ''
): Promise<WorkspaceFile[]> {
  const files: WorkspaceFile[] = [];
  for await (const entry of (handle as unknown as AsyncIterable<FileSystemHandle>)) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      files.push({
        name: entry.name,
        path: entryPath,
        kind: 'file',
        handle: entry as FileSystemFileHandle,
      });
    } else if (entry.kind === 'directory') {
      const subFiles = await readDirHandle(entry as FileSystemDirectoryHandle, entryPath);
      files.push({
        name: entry.name,
        path: entryPath,
        kind: 'directory',
        children: subFiles,
      });
    }
  }
  return files.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function readWebkitEntry(entry: any, currentPath = ''): Promise<WorkspaceFile> {
  return new Promise((resolve, reject) => {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.isFile) {
      entry.file(
        (file: File) => {
          resolve({
            name: entry.name,
            path: entryPath,
            kind: 'file',
            file,
          });
        },
        (err: any) => reject(err)
      );
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries: any[] = [];
      const readBatch = () => {
        dirReader.readEntries(
          async (results: any[]) => {
            if (!results || results.length === 0) {
              try {
                const children = await Promise.all(
                  entries.map((child) => readWebkitEntry(child, entryPath))
                );
                children.sort((a, b) => {
                  if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
                  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                });
                resolve({
                  name: entry.name,
                  path: entryPath,
                  kind: 'directory',
                  children,
                });
              } catch (err) {
                reject(err);
              }
            } else {
              entries.push(...results);
              readBatch();
            }
          },
          (err: any) => reject(err)
        );
      };
      readBatch();
    } else {
      resolve({
        name: entry.name,
        path: entryPath,
        kind: 'file',
      });
    }
  });
}

export default function WorkspaceExplorer() {
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const loadFile = useModelStore((s) => s.loadFile);
  const setCanGoBack = useModelStore((s) => s.setCanGoBack);
  const addConsoleLine = useModelStore((s) => s.addConsoleLine);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<WorkspaceFile[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleOpenFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        setFolderName(dirHandle.name);
        const tree = await readDirHandle(dirHandle, '');
        setFolderFiles(tree);
        setExpandedFolders(new Set(['']));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        folderInputRef.current?.click();
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleFallbackFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const firstPath = files[0].webkitRelativePath || files[0].name;
    const rootName = firstPath.split('/')[0] || 'Workspace';
    setFolderName(rootName);

    const tree: WorkspaceFile[] = [];
    const dirMap = new Map<string, WorkspaceFile>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/').slice(1);
      if (parts.length === 0) continue;

      let currentList = tree;
      let currPath = '';

      for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        currPath = currPath ? `${currPath}/${part}` : part;
        const isFile = p === parts.length - 1;

        if (isFile) {
          currentList.push({
            name: part,
            path: currPath,
            kind: 'file',
            file,
          });
        } else {
          let dir = dirMap.get(currPath);
          if (!dir) {
            dir = {
              name: part,
              path: currPath,
              kind: 'directory',
              children: [],
            };
            dirMap.set(currPath, dir);
            currentList.push(dir);
          }
          currentList = dir.children!;
        }
      }
    }

    setFolderFiles(tree);
  };

  const handleOpenFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.uploadFiles(formData);
        if (res.success) {
          await showSessionModel();
          setCanGoBack(true);
          addConsoleLine(`>>> Opened bundle: ${res.files.join(', ')}`);
        }
      } else {
        const text = await file.text();
        const stem = file.name.replace(/\.[^.]+$/, '') || 'model';
        const res = await api.newModel();
        await api.setModelName(stem);
        await api.putEescode(text);
        loadFile(file.name, text, '', '', '', stem, '');
        setCanGoBack(res.hadContent);
        addConsoleLine(`>>> Opened file: ${file.name}`);
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
    e.target.value = '';
  };

  const handleSelectWorkspaceFile = async (node: WorkspaceFile) => {
    if (node.kind === 'directory') {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
      return;
    }

    try {
      let file: File;
      if (node.handle) {
        file = await node.handle.getFile();
      } else if (node.file) {
        file = node.file;
      } else {
        return;
      }

      if (file.name.toLowerCase().endsWith('.zip')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.uploadFiles(formData);
        if (res.success) {
          await showSessionModel();
          setCanGoBack(true);
          addConsoleLine(`>>> Opened bundle: ${res.files.join(', ')}`);
        }
      } else {
        const text = await file.text();
        const stem = file.name.replace(/\.[^.]+$/, '') || 'model';
        const res = await api.newModel();
        await api.setModelName(stem);
        await api.putEescode(text);
        loadFile(file.name, text, '', '', '', stem, '');
        setCanGoBack(res.hadContent);
        addConsoleLine(`>>> Opened file: ${file.name}`);
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR opening ${node.name}: ${toErrMsg(err)}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if ('getAsFileSystemHandle' in item) {
          try {
            const handle = await (item as any).getAsFileSystemHandle();
            if (handle && handle.kind === 'directory') {
              const dirHandle = handle as FileSystemDirectoryHandle;
              setFolderName(dirHandle.name);
              const tree = await readDirHandle(dirHandle, '');
              setFolderFiles(tree);
              setExpandedFolders(new Set(['']));
              addConsoleLine(`>>> Opened workspace folder: ${dirHandle.name}`);
              return;
            }
          } catch {
          }
        }
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry && entry.isDirectory) {
            const dirNode = await readWebkitEntry(entry);
            setFolderName(dirNode.name);
            setFolderFiles(dirNode.children || []);
            setExpandedFolders(new Set(['']));
            addConsoleLine(`>>> Opened workspace folder: ${dirNode.name}`);
            return;
          }
        }
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith('.zip')) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.uploadFiles(formData);
          if (res.success) {
            await showSessionModel();
            setCanGoBack(true);
            addConsoleLine(`>>> Opened bundle: ${res.files.join(', ')}`);
          }
        } else {
          const text = await file.text();
          const stem = file.name.replace(/\.[^.]+$/, '') || 'model';
          const res = await api.newModel();
          await api.setModelName(stem);
          await api.putEescode(text);
          loadFile(file.name, text, '', '', '', stem, '');
          setCanGoBack(res.hadContent);
          addConsoleLine(`>>> Opened file: ${file.name}`);
        }
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR loading dropped item: ${toErrMsg(err)}`);
    }
  };

  const renderFileTree = (nodes: WorkspaceFile[], depth = 0) => {
    return nodes.map((node) => {
      const isDir = node.kind === 'directory';
      const isExpanded = expandedFolders.has(node.path);
      const isModelFile = node.name.endsWith('.eescode');

      return (
        <div key={node.path} style={{ paddingLeft: depth * 12 }}>
          <div
            className={`tree-node ${isDir ? 'tree-dir' : 'tree-file'} ${isModelFile ? 'is-model' : ''}`}
            onClick={() => handleSelectWorkspaceFile(node)}
          >
            {isDir ? (
              <>
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {isExpanded ? <FolderOpen size={13} className="node-icon folder-icon" /> : <Folder size={13} className="node-icon folder-icon" />}
                <span className="node-label">{node.name}</span>
              </>
            ) : (
              <>
                <FileCode size={13} className="node-icon file-icon" />
                <span className="node-label">{node.name}</span>
              </>
            )}
          </div>
          {isDir && isExpanded && node.children && (
            <div>{renderFileTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="workspace-explorer"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={folderInputRef}
        style={{ display: 'none' }}
        onChange={handleFallbackFolderChange}
        {...({ webkitdirectory: '', directory: '' } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
      />
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".eescode,.txt,.zip"
        onChange={handleFileChange}
      />
      <div className="explorer-header">
        <span className="explorer-title">
          {folderName ? folderName.toUpperCase() : 'EXPLORER'}
        </span>
        <div className="explorer-actions">
          {folderName && (
            <button
              className="icon-btn small"
              onClick={() => {
                setFolderName(null);
                setFolderFiles([]);
                setExpandedFolders(new Set());
              }}
              title="Close Workspace"
            >
              <X size={13} />
            </button>
          )}
          <button
            className="icon-btn small"
            onClick={handleOpenFileClick}
            title="Open File"
          >
            <Upload size={13} />
          </button>
          <button
            className="icon-btn small"
            onClick={handleOpenFolder}
            title="Open Folder"
          >
            <FolderOpen size={13} />
          </button>
          <button
            className="icon-btn small"
            onClick={toggleLeftPanel}
            title="Collapse Sidebar"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>
      <div className={`explorer-body ${isDragOver ? 'drag-over' : ''}`}>
        {folderFiles.length > 0 ? (
          renderFileTree(folderFiles)
        ) : (
          <div className="no-workspace-container">
            <FolderPlus size={36} className="no-workspace-icon" />
            <div className="no-workspace-title">NO WORKSPACE OPEN</div>
            <p className="no-workspace-hint">
              Drag & drop a folder here or click below to open a workspace.
            </p>
            <button className="no-workspace-btn" onClick={handleOpenFolder}>
              Open Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

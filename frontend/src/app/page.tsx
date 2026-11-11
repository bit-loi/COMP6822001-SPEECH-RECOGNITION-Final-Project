'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useContextManager } from '@/lib/memory';
import Editor from '@monaco-editor/react';
import { configureMonacoEditor, getMonacoLanguage } from '@/lib/monacoConfig';

import { FileNode, TerminalTab } from '@/types/editor';
import { getTranslation, type Language } from '@/lib/translations';

import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from '@/components/editor/Sidebar';
import { TopBar } from '@/components/editor/TopBar';
import { VoicePanel, type VoiceAction } from '@/components/editor/VoicePanel';
import { TerminalPanel } from '@/components/editor/TerminalPanel';
import { writeToTerminal } from '@/components/Terminal';
import { executeCode } from '@/services/compiler';
import { getMonacoOptions, defaultAccessibilitySettings } from '@/lib/editorConfig';
import { useToast } from '@/hooks/use-toast';

export default function EditorPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const contextManager = useContextManager();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const editorSettings = defaultAccessibilitySettings;

  const [code, setCode] = useState(`// ${getTranslation('sidebar.no_files', editorSettings.uiLanguage as Language)}!
// ${getTranslation('sidebar.no_files_desc', editorSettings.uiLanguage as Language)}.`);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [terminals, setTerminals] = useState<TerminalTab[]>([
    { id: '1', name: 'bash' }
  ]);
  const [activeTerminal, setActiveTerminal] = useState('1');
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Modal states
  const [showFileModal, setShowFileModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [modalParentPath, setModalParentPath] = useState('');
  const [newItemName, setNewItemName] = useState('');

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileNode | null>(null);

  // File tabs state
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  // OPTIMIZED: Use a Map (HashMap) for O(1) access, and sync it with a tree for display
  const [fileMap, setFileMap] = useState<Record<string, FileNode>>({});

  // Memoized tree generation from the flat map
  const fileTree = useMemo(() => {
    const rootNodes: FileNode[] = [];
    const map = { ...fileMap };
    
    // Sort paths to ensure parents are processed or just iterate and build
    Object.keys(map).sort().forEach(path => {
      const node = { ...map[path] };
      const parts = path.split('/');
      
      if (parts.length === 1) {
        rootNodes.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map[parentPath];
        if (parent && parent.type === 'folder') {
          if (!parent.children) parent.children = [];
          // Note: In a real Map approach, we'd use a different tree structure 
          // but for compatibility with existing Sidebar, we build this on the fly
          // and let children be managed by the parent in the final tree object.
        }
      }
    });

    // Correct implementation for building tree from flat map
    const tree: FileNode[] = [];
    const lookup: Record<string, FileNode> = {};

    Object.keys(fileMap).forEach(path => {
      lookup[path] = { ...fileMap[path], children: [] };
    });

    Object.keys(lookup).forEach(path => {
      const node = lookup[path];
      const parts = path.split('/');
      if (parts.length === 1) {
        tree.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        if (lookup[parentPath]) {
          lookup[parentPath].children?.push(node);
        } else {
          // Orphan or missing parent in map, put at root
          tree.push(node);
        }
      }
    });

    return tree;
  }, [fileMap]);

  // File upload refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    contextManager.startSession();

    return () => {
      contextManager.endSession();
    };
  }, []);

  useEffect(() => {
    if (currentFilePath && code) {
      contextManager.setCurrentFile(currentFilePath, code, 'rust');
    }
  }, [currentFilePath, code]);

  // Terminal resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTerminal) {
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
          const containerRect = editorContainer.getBoundingClientRect();
          // Calculate height from bottom of container to mouse position
          const newHeight = containerRect.bottom - e.clientY;
          console.log('Terminal resize:', { bottom: containerRect.bottom, clientY: e.clientY, newHeight });
          // Clamp between 100px and 800px
          setTerminalHeight(Math.max(100, Math.min(800, newHeight)));
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingTerminal(false);
    };

    if (isResizingTerminal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTerminal]);

  const handleEditorWillMount = (monaco: any) => {
    configureMonacoEditor(monaco);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setIsEditorReady(true);
    
    editor.onDidChangeModelContent(() => {
      const newCode = editor.getValue();
      setCode(newCode);
      
      contextManager.addEdit({
        type: 'replace',
        filePath: currentFilePath,
        position: { line: 0, column: 0 },
        content: newCode,
      });
    });
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'file') {
      setCurrentFilePath(node.path);
      setCode(node.content || '');
      if (!openFiles.includes(node.path)) {
        setOpenFiles(prev => [...prev, node.path]);
      }
    }
  };

  const handleCloseFile = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newOpenFiles = openFiles.filter(p => p !== path);
    setOpenFiles(newOpenFiles);
    
    if (currentFilePath === path) {
      if (newOpenFiles.length > 0) {
        const lastFile = newOpenFiles[newOpenFiles.length - 1];
        // Optimized: direct access from map
        const content = fileMap[lastFile]?.content || '';
        setCurrentFilePath(lastFile);
        setCode(content);
      } else {
        setCurrentFilePath('');
        setCode('// Welcome to AmbatuCode!');
      }
    }
  };

  const openFileModal = (parentPath: string) => {
    setModalParentPath(parentPath);
    setNewItemName('');
    setShowFileModal(true);
  };

  const openFolderModal = (parentPath: string) => {
    setModalParentPath(parentPath);
    setNewItemName('');
    setShowFolderModal(true);
  };

  const openDeleteModal = (item: FileNode) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const createFile = () => {
    if (!newItemName.trim()) return;

    const newFile: FileNode = {
      name: newItemName,
      type: 'file',
      path: modalParentPath ? `${modalParentPath}/${newItemName}` : newItemName,
      content: '',
    };

    setFileMap((prev: Record<string, FileNode>) => ({
      ...prev,
      [newFile.path]: newFile
    }));

    setShowFileModal(false);
    setNewItemName('');
  };

  const createFolder = () => {
    if (!newItemName.trim()) return;

    const newFolder: FileNode = {
      name: newItemName,
      type: 'folder',
      path: modalParentPath ? `${modalParentPath}/${newItemName}` : newItemName,
      children: [],
    };

    setFileMap((prev: Record<string, FileNode>) => ({
      ...prev,
      [newFolder.path]: newFolder
    }));

    setShowFolderModal(false);
    setNewItemName('');
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;

    // Close deleted file if it's open
    const isDeletedOpen = openFiles.some(p => p === itemToDelete.path || p.startsWith(itemToDelete.path + '/'));
    if (isDeletedOpen) {
      const newOpenFiles = openFiles.filter(p => p !== itemToDelete.path && !p.startsWith(itemToDelete.path + '/'));
      setOpenFiles(newOpenFiles);
      
      if (currentFilePath === itemToDelete.path || currentFilePath.startsWith(itemToDelete.path + '/')) {
        if (newOpenFiles.length > 0) {
          const lastFile = newOpenFiles[newOpenFiles.length - 1];
          // Optimization: Get content from map directly
          const content = fileMap[lastFile]?.content || '';
          setCurrentFilePath(lastFile);
          setCode(content);
        } else {
          setCurrentFilePath('');
          setCode('// Welcome to AmbatuCode!');
        }
      }
    }

    setFileMap((prev: Record<string, FileNode>) => {
      const next = { ...prev };
      const pathToDelete = itemToDelete.path;
      Object.keys(next).forEach(path => {
        if (path === pathToDelete || path.startsWith(pathToDelete + '/')) {
          delete next[path];
        }
      });
      return next;
    });

    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  // Upload file from local PC
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const content = await file.text();
      
      const newFile: FileNode = {
        name: file.name,
        type: 'file',
        path: file.name,
        content,
      };

      setFileMap((prev: Record<string, FileNode>) => ({ ...prev, [newFile.path]: newFile }));
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload folder from local PC
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const localFileMap = new Map<string, FileNode>();

    // Process all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = file.webkitRelativePath || file.name;
      const parts = relativePath.split('/');
      
      const content = await file.text();
      
      // Create file node
      const fileNode: FileNode = {
        name: parts[parts.length - 1],
        type: 'file',
        path: relativePath,
        content,
      };

      localFileMap.set(relativePath, fileNode);

      // Create folder nodes
      for (let j = 1; j < parts.length; j++) {
        const folderPath = parts.slice(0, j).join('/');
        if (!localFileMap.has(folderPath)) {
          const folderNode: FileNode = {
            name: parts[j - 1],
            type: 'folder',
            path: folderPath,
            children: [],
          };
          localFileMap.set(folderPath, folderNode);
        }
      }
    }

    // Sync with fileMap state
    setFileMap((prev: Record<string, FileNode>) => {
      const next = { ...prev };
      localFileMap.forEach((node, path) => {
        next[path] = node;
      });
      return next;
    });

    // Reset input
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const handleMoveItem = (sourcePath: string, targetFolderPath: string) => {
    setFileMap((prev: Record<string, FileNode>) => {
      const next = { ...prev };
      const movedNode = next[sourcePath];
      if (!movedNode) return prev;

      // Remove from old path and all children
      Object.keys(next).forEach(path => {
        if (path === sourcePath || path.startsWith(sourcePath + '/')) {
          const node = next[path];
          delete next[path];
          
          // Re-add with new path
          const relativePath = path.substring(sourcePath.length);
          const newPath = targetFolderPath + '/' + movedNode.name + relativePath;
          const newNode = { ...node, path: newPath };
          
          next[newPath] = newNode;
        }
      });

      return next;
    });

    // Automatically expand the target folder
    setExpandedFolders((prev: Set<string>) => new Set([...prev, targetFolderPath]));
    
    toast({
      title: "File Moved",
      description: `Moved to ${targetFolderPath.split('/').pop()}`,
    });
  };

  const addNewTerminal = () => {
    const newId = (terminals.length + 1).toString();
    setTerminals((prev: TerminalTab[]) => [...prev, {
      id: newId,
      name: 'bash',
    }]);
    setActiveTerminal(newId);
  };

  const closeTerminal = (id: string) => {
    if (terminals.length === 1) return;
    
    // Close terminal session on server
    fetch(`/api/terminal?sessionId=${id}`, { method: 'DELETE' });
    
    setTerminals((prev: TerminalTab[]) => prev.filter(t => t.id !== id));
    if (activeTerminal === id) {
      setActiveTerminal(terminals[0].id);
    }
  };

  const handleTerminalCommand = async (sessionId: string, command: string) => {
    try {
      // Echo command to terminal
      writeToTerminal(sessionId, `\r\n\x1b[1;32m> ${command}\x1b[0m\r\n`);

      // Execute command on real terminal
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          command,
        }),
      });

      const data = await response.json();
      
      // Write output to xterm terminal
      if (data.output && data.output.length > 0) {
          data.output.forEach((line: string) => {
            writeToTerminal(sessionId, line + '\r\n');
          });
      }
    } catch (error) {
      console.error('Terminal error:', error);
      writeToTerminal(sessionId, '\x1b[1;31mError: Failed to execute command\x1b[0m\r\n');
    }
  };

  const handleRun = async () => {
    if (!currentFilePath) return;
    
    // Ensure terminal is open
    if (!showTerminal) {
       setShowTerminal(true);
       // Wait for terminal component to mount
       await new Promise(resolve => setTimeout(resolve, 300));
    } else {
       // Small delay to ensure focus
       await new Promise(resolve => setTimeout(resolve, 50));
    }

    const ext = currentFilePath.split('.').pop()?.toLowerCase();
    
    if (!ext) {
      writeToTerminal(activeTerminal, '\x1b[1;31mError: Unknown file type\x1b[0m\r\n');
      return;
    }

    // Write start message
    writeToTerminal(activeTerminal, `\r\n\x1b[1;36m[Cloud] Running ${currentFilePath}...\x1b[0m\r\n`);

    try {
      const output = await executeCode(ext, code);
      
      // Write output to terminal (handle newlines)
      writeToTerminal(activeTerminal, output.replace(/\n/g, '\r\n') + '\r\n');
      writeToTerminal(activeTerminal, `\x1b[1;32m[Cloud] Execution finished.\x1b[0m\r\n\x1b[1;32m$\x1b[0m `);
    } catch (err) {
      writeToTerminal(activeTerminal, `\x1b[1;31mError: Execution failed\x1b[0m\r\n`);
    }
  };

  const handleVoiceAction = (action: VoiceAction | null) => {
    if (!action) return;

    const tabMatch = /^select_tab_(\d)$/.exec(action.action);
    if (tabMatch && openFiles.length > 0) {
      const path = openFiles[Number(tabMatch[1])];
      if (path) {
        setCurrentFilePath(path);
        setCode(fileMap[path]?.content ?? '');
      }
      return;
    }

    switch (action.action) {
      case 'execute_active_file':
        void handleRun();
        break;
      case 'stop_execution':
        writeToTerminal(activeTerminal, '^C\r\n');
        break;
      case 'scroll': {
        if (!editorRef.current) break;
        const direction = action.params?.direction;
        const currentScroll = editorRef.current.getScrollTop() as number;
        editorRef.current.setScrollPosition({
          scrollTop: Math.max(0, currentScroll + (direction === 'up' ? -240 : 240)),
        });
        break;
      }
      case 'switch_tab': {
        if (openFiles.length === 0) break;
        const currentIndex = Math.max(0, openFiles.indexOf(currentFilePath));
        const step = action.params?.direction === 'left' ? -1 : 1;
        const path = openFiles[(currentIndex + step + openFiles.length) % openFiles.length];
        setCurrentFilePath(path);
        setCode(fileMap[path]?.content ?? '');
        break;
      }
      case 'undo':
      case 'redo':
        editorRef.current?.trigger('keyboard', action.action);
        break;
      case 'toggle_theme':
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300 font-sans overflow-hidden transition-colors">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        fileTree={fileTree}
        expandedFolders={expandedFolders}
        toggleFolder={toggleFolder}
        handleFileClick={handleFileClick}
        currentFilePath={currentFilePath}
        onOpenFileModal={openFileModal}
        onOpenFolderModal={openFolderModal}
        onDelete={item => {
          setItemToDelete(item);
          setShowDeleteModal(true);
        }}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        handleFileUpload={handleFileUpload}
        handleFolderUpload={handleFolderUpload}
        uiLanguage={editorSettings.uiLanguage}
        onMoveItem={handleMoveItem}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TopBar Component */}
        <TopBar
           sidebarOpen={sidebarOpen}
           setSidebarOpen={setSidebarOpen}
           openFiles={openFiles}
           currentFilePath={currentFilePath}
           fileTree={fileTree}
           setCurrentFilePath={setCurrentFilePath}
           setCode={setCode}
           handleCloseFile={handleCloseFile}
           onRun={handleRun}
           uiLanguage={editorSettings.uiLanguage}
        />

        <div className="flex-1 flex overflow-hidden bg-background transition-colors min-w-0">
          {/* Editor and Terminal Container */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 editor-container relative bg-background transition-colors">
            <div className={`flex-1 relative bg-background transition-colors min-h-0 overflow-hidden ${isResizingTerminal ? 'pointer-events-none' : ''}`}>
              {!isEditorReady && (
                <div className="absolute inset-0 z-10 p-8 space-y-4 bg-background transition-colors">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-4 w-[300px]" />
                  <Skeleton className="h-4 w-[250px]" />
                  <div className="h-4" />
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[350px]" />
                  <Skeleton className="h-4 w-[280px]" />
                </div>
              )}
              <Editor
                className={`transition-opacity duration-300 ${isEditorReady ? 'opacity-100' : 'opacity-0'}`}
                height="100%"
                defaultLanguage="typescript"
                language={getMonacoLanguage(currentFilePath)}
                defaultValue="// Welcome to AmbatuCode!\n// Upload files or create new ones to get started."
                theme={mounted && resolvedTheme === 'light' ? 'ambatucode-light' : 'ambatucode-dark'}
                value={code}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorDidMount}
                options={{
                  ...getMonacoOptions(editorSettings),
                  minimap: { enabled: !editorSettings.minimalistUI },
                  renderLineHighlight: 'all',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  padding: { top: 16, bottom: 16 },
                  lineHeight: editorSettings.customLineHeight * editorSettings.fontSize,
                }}
              />
            </div>

            <TerminalPanel
              showTerminal={showTerminal}
              setShowTerminal={setShowTerminal}
              height={terminalHeight}
              isResizing={isResizingTerminal}
              setIsResizing={setIsResizingTerminal}
              terminals={terminals}
              activeTerminalId={activeTerminal}
              setActiveTerminalId={setActiveTerminal}
              onNewTerminal={addNewTerminal}
              onCloseTerminal={closeTerminal}
              onCommand={handleTerminalCommand}
              uiLanguage={editorSettings.uiLanguage}
            />
          </div>

          <VoicePanel onAction={handleVoiceAction} />
        </div>
      </div>

      {/* Modals */}
      {/* File Creation Modal */}
      {showFileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-200 dark:border-gray-800 w-80 shadow-lg">
            <h3 className="text-lg font-medium mb-4 text-black dark:text-white">Create New File</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="filename.ts"
              className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-700 rounded p-2 mb-4 outline-none focus:border-purple-500 text-black dark:text-white placeholder-gray-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createFile()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowFileModal(false)}
                className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded"
              >
                Cancel
              </button>
              <button
                onClick={createFile}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-200 dark:border-gray-800 w-80 shadow-lg">
            <h3 className="text-lg font-medium mb-4 text-black dark:text-white">Create New Folder</h3>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Folder Name"
              className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-300 dark:border-gray-700 rounded p-2 mb-4 outline-none focus:border-purple-500 text-black dark:text-white placeholder-gray-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-200 dark:border-gray-800 w-80 shadow-lg">
             <h3 className="text-lg font-medium mb-2 text-red-500">Delete {itemToDelete.type === 'folder' ? 'Folder' : 'File'}?</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Are you sure you want to delete <span className="font-bold text-gray-900 dark:text-gray-200">{itemToDelete.name}</span>? This action cannot be undone.</p>
             <div className="flex justify-end space-x-2">
               <button
                 onClick={() => setShowDeleteModal(false)}
                 className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded"
               >
                 Cancel
               </button>
               <button
                 onClick={confirmDelete}
                 className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-white"
               >
                 Delete
               </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

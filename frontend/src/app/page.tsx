'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { useTheme } from 'next-themes';
import { useGemini } from '@/hooks/useGemini';
import { useContextManager } from '@/lib/memory';
import Editor from '@monaco-editor/react';
import { Terminal as TerminalIcon, Plus, X, GripVertical, Loader2 } from 'lucide-react';
import { configureMonacoEditor, getMonacoLanguage } from '@/lib/monacoConfig';

import {
  FileNode,
  Message,
  TerminalTab,
  GitHubRepo,
  getLanguageFromFilename,
  findNodeContent,
  getProjectContext
} from '@/types/editor';
import { getTranslation, type Language } from '@/lib/translations';

import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from '@/components/editor/Sidebar';
import { TopBar } from '@/components/editor/TopBar';
import { ChatPanel } from '@/components/editor/ChatPanel';
import { TerminalPanel } from '@/components/editor/TerminalPanel';
import { CustomizationsPanel } from '@/components/editor/EditorSettings';
import { writeToTerminal } from '@/components/Terminal';
import { executeCode } from '@/services/compiler';
import { loadSettings, getMonacoOptions, defaultNeurodivergentSettings, type NeurodivergentEditorSettings } from '@/lib/editorConfig';
import { useToast } from '@/hooks/use-toast';

export default function EditorPage() {
  const { user, isAuthenticated, signInWithGitHub, signOut, initialize } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const gemini = useGemini();
  const contextManager = useContextManager();
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const [editorSettings, setEditorSettings] = useState<NeurodivergentEditorSettings>(() => {
    if (typeof window !== 'undefined') return loadSettings();
    return { focusMode: false, pomodoroEnabled: false, pomodoroWorkDuration: 25, pomodoroBreakDuration: 5, showTaskChunking: true, showTimeEstimates: true, reducedVisualNoise: false, disablePopups: false, colorScheme: 'default', minimalistUI: false, useDyslexicFont: false, increasedLetterSpacing: false, customLineHeight: 1.6, enhancedSyntaxColors: false, fontSize: 14, theme: 'dark', uiLanguage: 'en' };
  });

  const [code, setCode] = useState(`// ${getTranslation('sidebar.no_files', editorSettings.uiLanguage as Language)}!
// ${getTranslation('sidebar.no_files_desc', editorSettings.uiLanguage as Language)}.`);

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('neuravity_chat_history');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
          }
        } catch (e) {
          console.error('Failed to parse chat history', e);
        }
      }
    }
    return [
      {
        id: '1',
        role: 'assistant',
        content: getTranslation('chat.welcome', editorSettings.uiLanguage as Language),
        timestamp: new Date(),
      }
    ];
  });

  // Persist messages to sessionStorage
  useEffect(() => {
    if (mounted) {
      sessionStorage.setItem('neuravity_chat_history', JSON.stringify(messages));
    }
  }, [messages, mounted]);

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set()); // Fixed state declaration
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [chatWidth, setChatWidth] = useState(384);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [terminals, setTerminals] = useState<TerminalTab[]>([
    { id: '1', name: 'bash' }
  ]);
  const [activeTerminal, setActiveTerminal] = useState('1');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [showCustomizations, setShowCustomizations] = useState(false);

  // Update localized strings when language changes
  useEffect(() => {
    if (mounted) {
      if (messages.length === 1 && messages[0].id === '1') {
        setMessages([{
          ...messages[0],
          content: getTranslation('chat.welcome', editorSettings.uiLanguage as Language)
        }]);
      }
      if (code.startsWith('// ')) {
        setCode(`// ${getTranslation('sidebar.no_files', editorSettings.uiLanguage as Language)}!
// ${getTranslation('sidebar.no_files_desc', editorSettings.uiLanguage as Language)}.`);
      }
    }
  }, [editorSettings.uiLanguage, mounted]);

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

  // GitHub import states
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [importingRepo, setImportingRepo] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    initialize();
    contextManager.startSession();

    return () => {
      contextManager.endSession();
    };
  }, [initialize]);

  // Keyboard shortcuts for neurodivergent accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11: Toggle Focus Mode
      if (e.key === 'F11') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
      // Alt+C: Toggle Chat Panel
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        setChatCollapsed(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (currentFilePath && code) {
      contextManager.setCurrentFile(currentFilePath, code, 'rust');
    }
  }, [currentFilePath, code]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Chat resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingChat) {
        const newWidth = window.innerWidth - e.clientX;
        setChatWidth(Math.max(300, Math.min(window.innerWidth - 320, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingChat(false);
    };

    if (isResizingChat) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingChat]);

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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const getSessionToken = () => {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (accessToken) return accessToken;

        const authDataStr = localStorage.getItem('supabase-auth-token');
        if (authDataStr) {
           try {
              const authData = JSON.parse(authDataStr);
              if (authData?.currentSession?.access_token) {
                 return authData.currentSession.access_token;
              }
           } catch(e) {}
        }
        return '';
      }
      
      const token = getSessionToken();

      const response = await fetch('http://127.0.0.1:8000/api/agent/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          user_id: user?.id || 'demo_user',
          session_id: 'default_session',
          message: userMessage.content,
          editor_context: {
            filename: currentFilePath || 'unknown_file',
            file_language: currentFilePath ? getMonacoLanguage(currentFilePath) : 'javascript',
            cursor_line: 1,
            cursor_column: 1,
            selected_text: null,
            surrounding_code: code
          },
          ui_language: editorSettings.uiLanguage
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI Agent');
      }

      const data = await response.json();

      // ── Execute AI Actions ─────────────────────────────────────────────────
      if (data.actions && data.actions.length > 0) {
        for (const action of data.actions) {
          switch (action.type) {
            case 'create_file': {
              const newNode: FileNode = {
                name: action.filename.split('/').pop() || action.filename,
                type: 'file',
                path: action.filename,
                content: action.content || '',
              };
              setFileMap((prev: Record<string, FileNode>) => ({ ...prev, [newNode.path]: newNode }));
              setCurrentFilePath(action.filename);
              setCode(action.content || '');
              setOpenFiles((prev: string[]) => prev.includes(action.filename) ? prev : [...prev, action.filename]);
              break;
            }

            case 'delete_file': {
              setFileMap((prev: Record<string, FileNode>) => {
                const next = { ...prev };
                delete next[action.filename];
                return next;
              });
              setOpenFiles((prev: string[]) => {
                const newTabs = prev.filter(f => f !== action.filename);
                if (currentFilePath === action.filename) {
                  setCurrentFilePath(newTabs.length > 0 ? newTabs[newTabs.length - 1] : '');
                  if (newTabs.length === 0) setCode('// Select or create a file to start coding');
                }
                return newTabs;
              });
              break;
            }

            case 'create_folder': {
              const newNode: FileNode = {
                name: action.folder_name.split('/').pop() || action.folder_name,
                type: 'folder',
                path: action.folder_name,
                children: []
              };
              setFileMap((prev: Record<string, FileNode>) => ({ ...prev, [newNode.path]: newNode }));
              break;
            }

            case 'delete_folder': {
              setFileMap((prev: Record<string, FileNode>) => {
                const next = { ...prev };
                Object.keys(next).forEach(path => {
                  if (path === action.folder_name || path.startsWith(action.folder_name + '/')) {
                    delete next[path];
                  }
                });
                return next;
              });
              setOpenFiles((prev: string[]) => {
                const newTabs = prev.filter(f => !f.startsWith(action.folder_name));
                if (currentFilePath && currentFilePath.startsWith(action.folder_name)) {
                  setCurrentFilePath(newTabs.length > 0 ? newTabs[newTabs.length - 1] : '');
                  if (newTabs.length === 0) setCode('// Select or create a file to start coding');
                }
                return newTabs;
              });
              break;
            }

            case 'toggle_focus_mode': {
              const newState = action.state === 'on' ? true : action.state === 'off' ? false : !focusMode;
              setFocusMode(newState);
              setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, focusMode: newState }));
              break;
            }

            case 'toggle_chat_panel': {
              if (action.state === 'open') {
                setChatCollapsed(false);
              } else if (action.state === 'close') {
                setChatCollapsed(true);
              } else {
                setChatCollapsed((prev: boolean) => !prev);
              }
              break;
            }

            case 'toggle_theme': {
              if (action.theme === 'light') {
                setTheme('light');
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, theme: 'light' }));
              } else if (action.theme === 'dark') {
                setTheme('dark');
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, theme: 'dark' }));
              } else {
                const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, theme: newTheme }));
              }
              break;
            }

            case 'insert_code': {
              const pos = action.position || 'end';
              if (editorRef.current) {
                const model = editorRef.current.getModel();
                if (model) {
                  const lastLine = model.getLineCount();
                  const lastCol = model.getLineMaxColumn(lastLine);
                  const insertPos = pos === 'beginning'
                    ? { lineNumber: 1, column: 1 }
                    : { lineNumber: lastLine, column: lastCol };
                  editorRef.current.executeEdits('ai-agent', [{
                    range: { startLineNumber: insertPos.lineNumber, startColumn: insertPos.column, endLineNumber: insertPos.lineNumber, endColumn: insertPos.column },
                    text: (pos === 'end' ? '\n\n' : '') + action.code,
                  }]);
                }
              } else {
                setCode((prev: string) => prev + '\n\n' + action.code);
              }
              break;
            }

            case 'update_file': {
              setCode(action.content || '');
              if (editorRef.current) {
                editorRef.current.setValue(action.content || '');
              }
              break;
            }

            case 'run_command': {
              writeToTerminal(activeTerminal, action.command + '\n');
              break;
            }

            case 'search_code': {
              if (editorRef.current) {
                editorRef.current.getAction('actions.find')?.run();
              }
              break;
            }

            case 'update_cognitive_settings': {
              setEditorSettings((prev: NeurodivergentEditorSettings) => ({
                ...prev,
                useDyslexicFont: action.dyslexia_mode !== undefined ? action.dyslexia_mode : prev.useDyslexicFont,
                increasedLetterSpacing: action.dyslexia_mode !== undefined ? action.dyslexia_mode : prev.increasedLetterSpacing,
                showTaskChunking: action.task_chunking !== undefined ? action.task_chunking : prev.showTaskChunking,
                showTimeEstimates: action.time_estimates !== undefined ? action.time_estimates : prev.showTimeEstimates,
                reducedVisualNoise: action.reduced_noise !== undefined ? action.reduced_noise : prev.reducedVisualNoise,
                minimalistUI: action.reduced_noise !== undefined ? action.reduced_noise : prev.minimalistUI,
              }));
              break;
            }

            case 'set_ui_language': {
              if (action.language) {
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, uiLanguage: action.language }));
              }
              break;
            }

            case 'control_pomodoro': {
              if (action.state === 'start') {
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, pomodoroEnabled: true }));
              } else if (action.state === 'stop') {
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, pomodoroEnabled: false }));
              }
              if (action.work_minutes) {
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, pomodoroWorkDuration: action.work_minutes }));
              }
              if (action.break_minutes) {
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, pomodoroBreakDuration: action.break_minutes }));
              }
              break;
            }

            case 'execute_active_file': {
              if (currentFilePath) {
                const ext = currentFilePath.split('.').pop()?.toLowerCase();
                let runCmd = '';
                if (ext === 'py') runCmd = `python ${currentFilePath}`;
                else if (ext === 'js') runCmd = `node ${currentFilePath}`;
                else if (ext === 'go') runCmd = `go run ${currentFilePath}`;
                else if (ext === 'rs') runCmd = `cargo run`;
                
                if (runCmd) {
                  writeToTerminal(activeTerminal, runCmd + '\n');
                }
              }
              break;
            }

            case 'set_font_size': {
              if (action.size) {
                setEditorSettings((prev: NeurodivergentEditorSettings) => ({ ...prev, fontSize: action.size }));
              }
              break;
            }

            case 'reset_settings': {
              setEditorSettings(defaultNeurodivergentSettings);
              setFocusMode(false);
              setTheme('dark');
              break;
            }
          }
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev: Message[]) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I am sorry, but I am currently unable to answer your request. You may need to log in to properly access this feature.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
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
        setCode('// Welcome to Neuravity!');
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
          setCode('// Welcome to Neuravity!');
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

  // Fetch GitHub repositories
  const fetchGitHubRepos = async () => {
    setLoadingRepos(true);
    try {
      const response = await fetch(`/api/github?token=${user?.githubToken || ''}`);
      const repos = await response.json();
      setGithubRepos(repos);
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Import repository from GitHub
  const importGitHubRepo = async (repo: GitHubRepo) => {
    setImportingRepo(true);
    setSelectedRepo(repo);

    try {
      // Fetch root contents
      const response = await fetch('/api/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: user?.githubToken || '',
          owner: repo.owner.login,
          repo: repo.name,
          path: '',
        }),
      });

      const contents = await response.json();
      
      if (!Array.isArray(contents)) {
          throw new Error(contents.error || 'Invalid repository data');
      }

      // Recursively fetch folder contents
      const fetchFolderContents = async (items: any[]): Promise<FileNode[]> => {
        if (!Array.isArray(items)) return [];
        const nodes: FileNode[] = [];

        for (const item of items) {
          if (item.type === 'file') {
            nodes.push(item);
          } else if (item.type === 'folder') {
            try {
              // Fetch subfolder contents
              const subResponse = await fetch('/api/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: user?.githubToken || '',
                  owner: repo.owner.login,
                  repo: repo.name,
                  path: item.path,
                }),
              });

              if (!subResponse.ok) {
                 console.warn(`Failed to fetch subfolder: ${item.path}`);
                 nodes.push(item); // Add as empty folder if fetch fails
                 continue;
              }

              const subContents = await subResponse.json();
              const children = await fetchFolderContents(subContents);

              nodes.push({
                ...item,
                children,
              });
            } catch (e) {
               console.error(`Error in recursive fetch for ${item.path}:`, e);
               nodes.push(item);
            }
          }
        }

        return nodes;
      };

      const repoTree = await fetchFolderContents(contents);

      // Create root folder for the repo
      const repoNodes: Record<string, FileNode> = {};
      const traverseNodes = (nodes: FileNode[], parentPath: string = '') => {
        nodes.forEach(node => {
          const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
          repoNodes[fullPath] = { ...node, path: fullPath };
          if (node.children) traverseNodes(node.children, fullPath);
        });
      };

      const repoRoot: FileNode = {
        name: repo.name,
        type: 'folder',
        path: repo.name,
        children: repoTree
      };
      
      repoNodes[repo.name] = repoRoot;
      traverseNodes(repoTree, repo.name);

      setFileMap((prev: Record<string, FileNode>) => ({ ...prev, ...repoNodes }));
      setExpandedFolders((prev: Set<string>) => new Set([...prev, repo.name]));
      setShowGitHubModal(false);
      
      toast({
        title: "Success",
        description: `Imported ${repo.name} successfully!`,
      });
    } catch (error: any) {
      console.error('Failed to import repo:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Something went wrong while importing the repository. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImportingRepo(false);
      setSelectedRepo(null);
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

  const handleNewChat = () => {
    setMessages([{
      id: '1',
      role: 'assistant',
      content: getTranslation('chat.welcome', editorSettings.uiLanguage as Language),
      timestamp: new Date(),
    }]);
  };

  const handleShowHistory = () => {
    toast({
      title: "Work in Progress",
      description: getTranslation('chat.history_wip', editorSettings.uiLanguage as Language),
    });
  };

  return (
    <div className="flex h-screen bg-white dark:bg-[#1e1e1e] text-gray-700 dark:text-gray-300 font-sans overflow-hidden transition-colors">
      {/* Sidebar Component - hidden in focus mode */}
      {!focusMode && (
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
          onOpenGitHubModal={() => {
            setShowGitHubModal(true);
            fetchGitHubRepos();
          }}
          isAuthenticated={isAuthenticated}
          user={user}
          signInWithGitHub={signInWithGitHub}
          signOut={signOut}
          uiLanguage={editorSettings.uiLanguage}
          onMoveItem={handleMoveItem}
        />
      )}

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
           isResizingChat={isResizingChat}
           setIsResizingChat={setIsResizingChat}
           onRun={handleRun}
           focusMode={focusMode}
           setFocusMode={setFocusMode}
           chatCollapsed={chatCollapsed}
           setChatCollapsed={setChatCollapsed}
           onOpenCustomizations={() => setShowCustomizations(true)}
           uiLanguage={editorSettings.uiLanguage}
        />

        <div className="flex-1 flex overflow-hidden bg-background transition-colors min-w-0">
          {/* Editor and Terminal Container */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 editor-container relative bg-background transition-colors">
            <div className={`flex-1 relative bg-background transition-colors min-h-0 overflow-hidden ${isResizingTerminal || isResizingChat ? 'pointer-events-none' : ''}`}>
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
                defaultValue="// Welcome to Neuravity!\n// Upload files or create new ones to get started."
                theme={mounted && resolvedTheme === 'light' ? 'neuravity-light' : 'neuravity-dark'}
                value={code}
                beforeMount={handleEditorWillMount}
                onMount={handleEditorDidMount}
                options={{
                  ...getMonacoOptions(editorSettings),
                  minimap: { enabled: !focusMode && !editorSettings.minimalistUI },
                  renderLineHighlight: 'all',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  padding: { top: 16, bottom: 16 },
                  lineHeight: editorSettings.customLineHeight * editorSettings.fontSize,
                }}
              />
            </div>

            {/* Terminal Panel - hidden in focus mode */}
            {!focusMode && (
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
            )}
          </div>

          {/* Chat Resize Handle - hidden in focus/collapse mode */}
          {!focusMode && !chatCollapsed && (
            <div
              className={`w-1 cursor-ew-resize flex-shrink-0 transition-colors z-20 hover:bg-purple-500 ${
                isResizingChat ? 'bg-purple-500' : 'bg-transparent border-l border-gray-200 dark:border-zinc-800'
              }`}
              onMouseDown={() => setIsResizingChat(true)}
            />
          )}

          {/* Chat Panel - hidden in focus mode, collapsible */}
          {!focusMode && !chatCollapsed && (
            <ChatPanel 
               width={chatWidth}
               messages={messages}
               inputValue={inputValue}
               setInputValue={setInputValue}
               handleSendMessage={handleSendMessage}
               isSending={isSending}
               messagesEndRef={messagesEndRef}
               isResizing={isResizingChat}
               setIsResizing={setIsResizingChat}
               uiLanguage={editorSettings.uiLanguage}
               onNewChat={handleNewChat}
               onShowHistory={handleShowHistory}
            />
          )}
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

      {/* GitHub Import Modal */}
      {showGitHubModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-200 dark:border-gray-800 w-96 max-h-[80vh] flex flex-col shadow-lg">
            <h3 className="text-lg font-medium mb-4 text-black dark:text-white">Import from GitHub</h3>
            
            {loadingRepos ? (
               <div className="flex items-center justify-center py-8">
                 <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
               </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-2">
                  {Array.isArray(githubRepos) ? (
                    githubRepos.map(repo => (
                      <button
                        key={repo.id}
                        onClick={() => importGitHubRepo(repo)}
                        disabled={importingRepo}
                        className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded border border-gray-200 dark:border-gray-800 hover:border-purple-500/50 transition-colors"
                      >
                        <div className="font-medium text-sm text-black dark:text-white">{repo.full_name}</div>
                        <div className="text-xs text-gray-500 truncate">{repo.description}</div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-red-500 text-sm">
                      {(githubRepos as any)?.error || 'Failed to load repositories. Please check your GitHub token.'}
                    </div>
                  )}
                </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowGitHubModal(false)}
                className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Customizations Panel (Side Sheet) */}
      <CustomizationsPanel
        open={showCustomizations}
        onOpenChange={setShowCustomizations}
        settings={editorSettings}
        onSettingsChange={(s) => {
          setEditorSettings(s);
          if (s.focusMode !== focusMode) setFocusMode(s.focusMode);
        }}
      />
    </div>
  );
}

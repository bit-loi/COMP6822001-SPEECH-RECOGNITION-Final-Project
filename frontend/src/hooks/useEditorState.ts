import { useState, useRef } from 'react';
import { FileNode, TerminalTab, Message } from '@/types/editor';

export const useEditorState = () => {
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [chatWidth, setChatWidth] = useState(384);
  
  // File Tree State
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentFilePath, setCurrentFilePath] = useState('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [code, setCode] = useState('');
  
  // Terminal State
  const [terminals, setTerminals] = useState<TerminalTab[]>([
    { id: '1', name: 'bash' }
  ]);
  const [activeTerminal, setActiveTerminal] = useState('1');
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Modal States
  const [showFileModal, setShowFileModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [modalParentPath, setModalParentPath] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [itemToDelete, setItemToDelete] = useState<FileNode | null>(null);
  
  // Resize State
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  return {
    // UI State
    sidebarOpen,
    setSidebarOpen,
    showTerminal,
    setShowTerminal,
    terminalHeight,
    setTerminalHeight,
    chatWidth,
    setChatWidth,
    
    // File Tree State
    fileTree,
    setFileTree,
    expandedFolders,
    setExpandedFolders,
    currentFilePath,
    setCurrentFilePath,
    openFiles,
    setOpenFiles,
    code,
    setCode,
    
    // Terminal State
    terminals,
    setTerminals,
    activeTerminal,
    setActiveTerminal,
    
    // Chat State
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isSending,
    setIsSending,
    
    // Modal States
    showFileModal,
    setShowFileModal,
    showFolderModal,
    setShowFolderModal,
    showDeleteModal,
    setShowDeleteModal,
    showGitHubModal,
    setShowGitHubModal,
    modalParentPath,
    setModalParentPath,
    newItemName,
    setNewItemName,
    itemToDelete,
    setItemToDelete,
    
    // Resize State
    isResizingTerminal,
    setIsResizingTerminal,
    isResizingChat,
    setIsResizingChat,
    
    // Refs
    fileInputRef,
    folderInputRef,
    messagesEndRef,
    editorRef,
  };
};

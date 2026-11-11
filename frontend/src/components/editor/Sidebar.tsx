import React from 'react';
import {
  FolderGit2,
  File,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Trash2,
  X,
  Github,
  Upload,
  FolderUp,
  LogOut,
  FolderOpen,
  FileCode,
  FileText,
  Settings,
  Image,
  Download
} from 'lucide-react';
import { FileNode, findNode } from '@/types/editor';
import { exportProjectZip } from '@/lib/exportUtils';
import { getTranslation, type Language } from '@/lib/translations';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  fileTree: FileNode[];
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  handleFileClick: (node: FileNode) => void;
  currentFilePath: string;
  onOpenFileModal: (path: string) => void;
  onOpenFolderModal: (path: string) => void;
  onDelete: (node: FileNode) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenGitHubModal: () => void;
  isAuthenticated: boolean;
  user: any;
  signInWithGitHub: () => void;
  signOut: () => void;
  uiLanguage: string;
  onMoveItem: (sourcePath: string, targetFolderPath: string) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'py':
      return <i className="devicon-python-plain text-sm"></i>;
    case 'js':
      return <i className="devicon-javascript-plain text-sm text-[#F7DF1E]"></i>;
    case 'jsx':
      return <i className="devicon-react-original text-sm text-[#61DAFB]"></i>;
    case 'ts':
      return <i className="devicon-typescript-plain text-sm text-[#3178C6]"></i>;
    case 'tsx':
      return <i className="devicon-react-original text-sm text-[#61DAFB]"></i>;
    case 'java':
      return <i className="devicon-java-plain text-sm text-[#007396]"></i>;
    case 'cpp':
    case 'cc':
    case 'cxx':
      return <i className="devicon-cplusplus-plain text-sm text-[#00599C]"></i>;
    case 'c':
      return <i className="devicon-c-plain text-sm text-[#A8B9CC]"></i>;
    case 'go':
      return <i className="devicon-go-original-wordmark text-sm text-[#00ADD8]"></i>;
    case 'rs':
      return <i className="devicon-rust-original text-sm"></i>;
    case 'php':
      return <i className="devicon-php-plain text-sm text-[#777BB4]"></i>;
    case 'rb':
      return <i className="devicon-ruby-plain text-sm text-[#CC342D]"></i>;
    case 'swift':
      return <i className="devicon-swift-plain text-sm text-[#FA7343]"></i>;
    case 'kt':
    case 'kts':
      return <i className="devicon-kotlin-plain text-sm text-[#7F52FF]"></i>;
    case 'cs':
      return <i className="devicon-csharp-plain text-sm text-[#239120]"></i>;
    case 'dart':
      return <i className="devicon-dart-plain text-sm text-[#0175C2]"></i>;
    case 'lua':
      return <i className="devicon-lua-plain text-sm text-[#2C2D72]"></i>;
    case 'r':
      return <i className="devicon-r-original text-sm text-[#276DC3]"></i>;
    case 'sh':
    case 'bash':
      return <i className="devicon-bash-plain text-sm text-[#4EAA25]"></i>;
    case 'json':
      return <i className="devicon-json-plain text-sm text-[#FFA500]"></i>;
    case 'md':
      return <i className="devicon-markdown-original text-sm"></i>;
    case 'html':
      return <i className="devicon-html5-plain text-sm text-[#E34F26]"></i>;
    case 'css':
      return <i className="devicon-css3-plain text-sm text-[#1572B6]"></i>;
    case 'sql':
      return <i className="devicon-mysql-plain text-sm text-[#CC2927]"></i>;
    case 'txt':
      return <FileText className="w-4 h-4" />;
    case 'env':
      return <Settings className="w-4 h-4 text-[#ECD53F]" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <Image className="w-4 h-4 text-purple-500" />;
    default:
      return <FileCode className="w-4 h-4" />;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  fileTree,
  expandedFolders,
  toggleFolder,
  handleFileClick,
  currentFilePath,
  onOpenFileModal,
  onOpenFolderModal,
  onDelete,
  fileInputRef,
  folderInputRef,
  handleFileUpload,
  handleFolderUpload,
  onOpenGitHubModal,
  isAuthenticated,
  user,
  signInWithGitHub,
  signOut,
  uiLanguage,
  onMoveItem,
}) => {
  const t = (key: string) => getTranslation(key, uiLanguage as Language);
  const [dragOverPath, setDragOverPath] = React.useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData('sourcePath', path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, path: string, isFolder: boolean) => {
    if (isFolder) {
      e.preventDefault();
      setDragOverPath(path);
    }
  };

  const handleDragLeave = () => {
    setDragOverPath(null);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    setDragOverPath(null);
    const sourcePath = e.dataTransfer.getData('sourcePath');
    if (sourcePath && sourcePath !== targetPath && !targetPath.startsWith(sourcePath + '/')) {
      onMoveItem(sourcePath, targetPath);
    }
  };

  const renderFileTree = (nodes: FileNode[], depth: number = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div 
          className={`group relative ${dragOverPath === node.path ? "bg-purple-500/10 rounded" : ""}`}
          onDragOver={(e) => handleDragOver(e, node.path, node.type === 'folder')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => node.type === 'folder' && handleDrop(e, node.path)}
        >
          <button
            draggable={node.type === 'file'}
            onDragStart={(e) => node.type === 'file' && handleDragStart(e, node.path)}
            onClick={() => node.type === 'folder' ? toggleFolder(node.path) : handleFileClick(node)}
            className={`w-full flex items-center space-x-2 px-2 py-1 pr-4 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-sm text-left transition-colors ${
              node.path === currentFilePath ? 'bg-gray-200 dark:bg-gray-800' : ''
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {node.type === 'folder' ? (
              <>
                {expandedFolders.has(node.path) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
                <FolderGit2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </>
            ) : (
              <>
                <div className="w-4" />
                {getFileIcon(node.name)}
              </>
            )}
            <span className={`truncate ${node.path === currentFilePath ? 'text-black dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              {node.name}
            </span>
          </button>
        </div>
        
        {node.type === 'folder' && expandedFolders.has(node.path) && node.children && (
          <div>
            {renderFileTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div 
      className={`h-full flex flex-col text-sm border-r border-gray-200 dark:border-[#333333] bg-gray-50 dark:bg-[#252526] transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
      }`}
      style={{ 
        minWidth: isOpen ? '256px' : '0px',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t("sidebar.project") || "Project"}
        </div>
        <div className="flex items-center space-x-0.5 transition-opacity duration-200">
          <button 
            onClick={onOpenGitHubModal}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Import from GitHub"
          >
            <Github className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={() => onOpenFileModal('')}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="New File..."
          >
            <FilePlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={() => onOpenFolderModal('')}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="New Folder..."
          >
            <FolderPlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={() => {
              if (currentFilePath) {
                const node = findNode(fileTree, currentFilePath);
                if (node) onDelete(node);
              }
            }}
            disabled={!currentFilePath}
            className={`p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors ${!currentFilePath ? 'opacity-30 cursor-not-allowed' : 'hover:text-red-500'}`}
            title="Delete current file"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Upload File"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={() => folderInputRef.current?.click()}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Upload Folder"
          >
            <FolderUp className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={() => exportProjectZip(fileTree)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Export Project sebagai ZIP"
          >
            <Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded lg:hidden transition-colors ml-1"
            title="Close Sidebar"
          >
            <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Inputs (Hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderUpload}
        className="hidden"
        {...({ webkitdirectory: "" } as any)}
        {...({ directory: "" } as any)}
        multiple
      />


      {/* File Tree */}
      <div className={`flex-1 overflow-y-auto p-2 transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {fileTree.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-8">
            <p>{t("sidebar.no_files") || "No files yet"}</p>
            <p className="mt-1">{t("sidebar.no_files_desc") || "Create or upload files to get started"}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {renderFileTree(fileTree)}
          </div>
        )}
      </div>

      {/* Footer (User) */}
      <div className={`p-3 border-t border-gray-200 dark:border-[#333333] bg-white dark:bg-[#252526] transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img 
                src={user.avatar || "https://github.com/github.png"} 
                alt="Profile" 
                className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[100px]">{user.name}</span>
            </div>
            <button 
              onClick={signOut}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={signInWithGitHub}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 bg-[#24292e] hover:bg-[#1b1f23] text-white rounded text-xs transition-colors"
          >
            <Github className="w-3 h-3" />
            <span>{t("sidebar.sign_in") || "Sign in with GitHub"}</span>
          </button>
        )}
      </div>
    </div>
  );
};

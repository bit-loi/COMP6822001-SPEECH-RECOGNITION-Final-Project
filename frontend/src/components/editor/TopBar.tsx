import React from 'react';
import { Menu, X, Play, FileCode, FileText, Settings, Image } from 'lucide-react';
import { AutoSaveIndicator } from '@/components/memory';
import { ModeToggle } from '@/components/mode-toggle';
import { FileNode, findNodeContent } from '@/types/editor';
import { getTranslation, type Language } from '@/lib/translations';

interface TopBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  openFiles: string[];
  currentFilePath: string;
  fileTree: FileNode[];
  setCurrentFilePath: (path: string) => void;
  setCode: (code: string) => void;
  handleCloseFile: (path: string, e: React.MouseEvent) => void;
  onRun: () => void;
  uiLanguage: string;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // Return Devicon icons for each language
  switch (ext) {
    case 'py':
      return <i className="devicon-python-plain text-base"></i>;
    case 'js':
      return <i className="devicon-javascript-plain text-base text-[#F7DF1E]"></i>;
    case 'jsx':
      return <i className="devicon-react-original text-base text-[#61DAFB]"></i>;
    case 'ts':
      return <i className="devicon-typescript-plain text-base text-[#3178C6]"></i>;
    case 'tsx':
      return <i className="devicon-react-original text-base text-[#61DAFB]"></i>;
    case 'java':
      return <i className="devicon-java-plain text-base text-[#007396]"></i>;
    case 'cpp':
    case 'cc':
    case 'cxx':
      return <i className="devicon-cplusplus-plain text-base text-[#00599C]"></i>;
    case 'c':
      return <i className="devicon-c-plain text-base text-[#A8B9CC]"></i>;
    case 'go':
      return <i className="devicon-go-original-wordmark text-base text-[#00ADD8]"></i>;
    case 'rs':
      return <i className="devicon-rust-original text-base"></i>;
    case 'php':
      return <i className="devicon-php-plain text-base text-[#777BB4]"></i>;
    case 'rb':
      return <i className="devicon-ruby-plain text-base text-[#CC342D]"></i>;
    case 'swift':
      return <i className="devicon-swift-plain text-base text-[#FA7343]"></i>;
    case 'kt':
    case 'kts':
      return <i className="devicon-kotlin-plain text-base text-[#7F52FF]"></i>;
    case 'cs':
      return <i className="devicon-csharp-plain text-base text-[#239120]"></i>;
    case 'dart':
      return <i className="devicon-dart-plain text-base text-[#0175C2]"></i>;
    case 'lua':
      return <i className="devicon-lua-plain text-base text-[#2C2D72]"></i>;
    case 'r':
      return <i className="devicon-r-original text-base text-[#276DC3]"></i>;
    case 'sh':
    case 'bash':
      return <i className="devicon-bash-plain text-base text-[#4EAA25]"></i>;
    case 'json':
      return <i className="devicon-json-plain text-base text-[#FFA500]"></i>;
    case 'md':
      return <i className="devicon-markdown-original text-base"></i>;
    case 'html':
      return <i className="devicon-html5-plain text-base text-[#E34F26]"></i>;
    case 'css':
      return <i className="devicon-css3-plain text-base text-[#1572B6]"></i>;
    case 'sql':
      return <i className="devicon-mysql-plain text-base text-[#CC2927]"></i>;
    case 'txt':
      return <FileText className="w-3 h-3" />;
    case 'env':
      return <Settings className="w-3 h-3 text-[#ECD53F]" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <Image className="w-3 h-3 text-purple-500" />;
    default:
      return <FileCode className="w-3 h-3" />;
  }
};

export const TopBar: React.FC<TopBarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  openFiles,
  currentFilePath,
  fileTree,
  setCurrentFilePath,
  setCode,
  handleCloseFile,
  onRun,
  uiLanguage,
}) => {
  const t = (key: string) => getTranslation(key, uiLanguage as Language);

  return (
    <div className="h-9 bg-gray-100 dark:bg-[#1e1e1e] flex items-center justify-between border-b border-gray-200 dark:border-[#333333] transition-colors">
      <div className="flex items-center flex-1 min-w-0 overflow-hidden">
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)} 
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-none h-9 flex items-center justify-center border-r border-gray-200 dark:border-[#333333]"
          >
            <Menu className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
        
        <div className="flex-1 flex overflow-x-auto no-scrollbar">
          {openFiles.length === 0 ? (
            <div className="px-4 flex items-center text-xs text-gray-500 italic h-9">
              {t("sidebar.no_open_files") || "No open files"}
            </div>
          ) : (
            openFiles.map(path => (
              <div
                key={path}
                onClick={() => {
                  setCurrentFilePath(path);
                  const content = findNodeContent(fileTree, path);
                  if (content) setCode(content);
                }}
                className={`flex items-center space-x-2 px-3 h-9 cursor-pointer text-xs border-r border-gray-200 dark:border-[#333333] min-w-fit max-w-[200px] group transition-colors ${
                  currentFilePath === path ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white border-t-2 border-t-purple-500' : 'bg-gray-200 dark:bg-[#2d2d2d] text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-[#252525]'
                }`}
                title={path}
              >
                <div className={currentFilePath === path ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}>
                  {getFileIcon(path)}
                </div>
                <span className="truncate">{path.split('/').pop()}</span>
                <button 
                  onClick={(e) => handleCloseFile(path, e)}
                  className={`p-0.5 rounded-sm hover:bg-gray-300 dark:hover:bg-gray-700 ${currentFilePath === path ? 'text-gray-400 hover:text-black dark:hover:text-white' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 px-3 flex-shrink-0">
         <button
           onClick={onRun}
           className="flex items-center space-x-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 dark:bg-purple-700 dark:hover:bg-purple-600 rounded-full text-xs text-white font-medium transition-colors shadow-sm"
           title="Run Code (Ctrl+Enter)"
         >
           <Play className="w-3.5 h-3.5 fill-current" />
           <span>{t("topbar.run") || "Run"}</span>
         </button>
         <ModeToggle />
         <AutoSaveIndicator />
      </div>
    </div>
  );
};

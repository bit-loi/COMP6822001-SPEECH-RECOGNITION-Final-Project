import React from 'react';
import dynamic from 'next/dynamic';
import { GripVertical, Terminal as TerminalIcon, X, Plus } from 'lucide-react';
import { TerminalTab } from '@/types/editor';
import { getTranslation, type Language } from '@/lib/translations';

const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });

interface TerminalPanelProps {
  showTerminal: boolean;
  setShowTerminal: (show: boolean) => void;
  height: number;
  // We don't need setHeight if resizing is handled by parent, but parent passes height.
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  terminals: TerminalTab[];
  activeTerminalId: string;
  setActiveTerminalId: (id: string) => void;
  onNewTerminal: () => void;
  onCloseTerminal: (id: string) => void;
  onCommand: (sessionId: string, cmd: string) => void;
  uiLanguage: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  showTerminal,
  setShowTerminal,
  height,
  isResizing,
  setIsResizing,
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  onNewTerminal,
  onCloseTerminal,
  onCommand,
  uiLanguage,
}) => {
  const t = (key: string) => getTranslation(key, uiLanguage as Language);

  return (
    <div className="flex flex-col">
       {/* Terminal */}
       {showTerminal && (
         <div 
           style={{ height: `${height}px` }}
           className="flex flex-col bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-[#333333] transition-colors"
         >
           {/* Resize Handle */}
           <div
             className={`h-1 cursor-ns-resize flex-shrink-0 transition-colors z-20 hover:bg-purple-500 ${
               isResizing ? 'bg-purple-500' : 'bg-transparent border-t border-gray-200 dark:border-[#333333]'
             }`}
             onMouseDown={() => setIsResizing(true)}
           />

           {/* Terminal Tabs */}
           <div className="flex items-center justify-between bg-gray-50 dark:bg-[#252526] border-b border-gray-200 dark:border-[#333333] px-2 box-border transition-colors">
             <div className="flex items-center space-x-1 overflow-x-auto">
               {terminals.map(term => (
                 <div
                   key={term.id}
                   className={`flex items-center space-x-2 px-3 py-1.5 text-xs cursor-pointer rounded-t-sm transition-colors ${
                     activeTerminalId === term.id 
                       ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white border-t-2 border-purple-500' 
                       : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2d2d2d] hover:text-gray-700 dark:hover:text-gray-300'
                   }`}
                   onClick={() => setActiveTerminalId(term.id)}
                 >
                   <TerminalIcon className="w-3 h-3" />
                   <span>{term.name}</span>
                   {terminals.length > 1 && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         onCloseTerminal(term.id);
                       }}
                       className="hover:text-red-500 dark:hover:text-red-400 ml-1 rounded-sm p-0.5 hover:bg-gray-300 dark:hover:bg-gray-700"
                     >
                       <X className="w-3 h-3" />
                     </button>
                   )}
                 </div>
               ))}
               <button
                 onClick={onNewTerminal}
                 className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400"
                 title="New Terminal"
               >
                 <Plus className="w-3 h-3" />
               </button>
             </div>
             <button
               onClick={() => setShowTerminal(false)}
               className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400"
             >
               <X className="w-3 h-3" />
             </button>
           </div>

           {/* Terminal Content - XTerm.js */}
           <div 
             className="flex-1 overflow-hidden bg-white dark:bg-[#1e1e1e]"
             style={{ pointerEvents: isResizing ? 'none' : 'auto' }}
           >
             <Terminal 
               sessionId={activeTerminalId}
               onCommand={(cmd: string) => onCommand(activeTerminalId, cmd)}
             />
           </div>
         </div>
       )}

       {/* Show Terminal Button */}
       {!showTerminal && (
         <div className="border-t border-gray-800 bg-[#1a1a1a] p-2">
           <button
             onClick={() => setShowTerminal(true)}
             className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs"
           >
             <TerminalIcon className="w-3 h-3" />
             <span>Terminal</span>
           </button>
         </div>
       )}
    </div>
  );
};

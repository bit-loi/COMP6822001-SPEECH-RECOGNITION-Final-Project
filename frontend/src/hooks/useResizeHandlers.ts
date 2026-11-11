import { useEffect } from 'react';

interface UseResizeHandlersProps {
  isResizingTerminal: boolean;
  isResizingChat: boolean;
  setTerminalHeight: (height: number) => void;
  setChatWidth: (width: number) => void;
  setIsResizingTerminal: (resizing: boolean) => void;
  setIsResizingChat: (resizing: boolean) => void;
}

export const useResizeHandlers = ({
  isResizingTerminal,
  isResizingChat,
  setTerminalHeight,
  setChatWidth,
  setIsResizingTerminal,
  setIsResizingChat,
}: UseResizeHandlersProps) => {
  // Terminal resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingTerminal) {
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
          const containerRect = editorContainer.getBoundingClientRect();
          const newHeight = containerRect.bottom - e.clientY;
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
  }, [isResizingTerminal, setTerminalHeight, setIsResizingTerminal]);

  // Chat resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingChat) {
        const newWidth = window.innerWidth - e.clientX;
        setChatWidth(Math.max(300, Math.min(600, newWidth)));
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
  }, [isResizingChat, setChatWidth, setIsResizingChat]);
};

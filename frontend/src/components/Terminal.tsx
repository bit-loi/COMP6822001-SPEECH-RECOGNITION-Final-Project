'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import 'xterm/css/xterm.css';
import type { Terminal as XTermType } from 'xterm';
import type { FitAddon as FitAddonType } from 'xterm-addon-fit';

interface TerminalProps {
  sessionId: string;
  onCommand?: (command: string) => void;
}

const darkTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#000000',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(0,0,0,0.3)',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
};

export default function Terminal({ sessionId, onCommand }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTermType | null>(null);
  const fitAddonRef = useRef<FitAddonType | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    // Prevent double initialization
    if (xtermRef.current) return;
    
    let term: XTermType | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let isMounted = true;
    let isInitializing = false;

    const initTerminal = async () => {
        if (!terminalRef.current || isInitializing) return;
        isInitializing = true;

        try {
            // Dynamic imports to avoid execution during SSR
            const { Terminal: XTerm } = await import('xterm');
            const { FitAddon } = await import('xterm-addon-fit');
            const { WebLinksAddon } = await import('xterm-addon-web-links');

            if (!isMounted || !terminalRef.current) return;

            term = new XTerm({
                cursorBlink: true,
                fontSize: 13,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: theme === 'dark' ? darkTheme : lightTheme,
                allowProposedApi: true,
                rows: 24,
                cols: 80,
            });

            const fitAddon = new FitAddon();
            const webLinksAddon = new WebLinksAddon();
            term.loadAddon(fitAddon);
            term.loadAddon(webLinksAddon);
            
            term.open(terminalRef.current);
            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            // Connect to Go Backend via Native WebSocket
            const ws = new WebSocket('ws://localhost:3002/ws');
            wsRef.current = ws;

            ws.onopen = () => {
                // Connected
            };

            ws.onmessage = async (event) => {
                const currentTerm = xtermRef.current;
                if (!currentTerm) return;

                try {
                    let textToWrite = '';

                    // 1. Strict Type Guard - ONLY accept string or Blob
                    if (typeof event.data === 'string') {
                        textToWrite = event.data;
                    } else if (event.data instanceof Blob) {
                        textToWrite = await event.data.text();
                    } else if (event.data instanceof ArrayBuffer) {
                        textToWrite = new TextDecoder().decode(event.data);
                    } else {
                        console.error('[Terminal] Unexpected data type:', typeof event.data, event.data);
                        return; // STOP - don't try to convert unknown types
                    }

                    // 2. Ensure we have a valid string
                    if (typeof textToWrite !== 'string') {
                        console.error('[Terminal] textToWrite is not a string:', typeof textToWrite);
                        return;
                    }

                    // 3. JSON Guard
                    const trimmed = textToWrite.trim();
                    if (trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.length < 1000) {
                        try {
                            const parsed = JSON.parse(textToWrite);
                            console.warn('[Terminal] Blocked JSON:', parsed);
                            
                            if (parsed.message) {
                                textToWrite = String(parsed.message);
                            } else if (parsed.output) {
                                textToWrite = String(parsed.output);
                            } else {
                                return; 
                            }
                        } catch (e) {
                            // Not JSON, continue
                        }
                    }

                    // 4. Final safety check before write
                    if (textToWrite && typeof textToWrite === 'string') {
                        currentTerm.write(textToWrite);
                    }

                } catch (err) {
                    console.error('[Terminal] Error processing message:', err);
                }
            };

            ws.onerror = () => {
                 xtermRef.current?.write('\r\n\x1b[1;31mConnection error. Is the Go Backend running on port 3002?\x1b[0m\r\n');
            };

            ws.onclose = () => {
                 xtermRef.current?.write('\r\n\x1b[1;35mConnection closed.\x1b[0m\r\n');
            };

            term.onData((data) => {
                const currentTerm = xtermRef.current;
                if (!currentTerm || ws.readyState !== WebSocket.OPEN) return;

                // Handle Enter key - send command
                if (data === '\r') {
                    const commandBuffer = (currentTerm as any)._commandBuffer || '';
                    
                    // Echo newline
                    currentTerm.write('\r\n');
                    
                    // Send command to backend
                    if (commandBuffer.trim()) {
                        ws.send(commandBuffer);
                    }
                    
                    // Clear buffer
                    (currentTerm as any)._commandBuffer = '';
                } 
                // Handle Backspace
                else if (data === '\x7f') {
                    const commandBuffer = (currentTerm as any)._commandBuffer || '';
                    if (commandBuffer.length > 0) {
                        (currentTerm as any)._commandBuffer = commandBuffer.slice(0, -1);
                        currentTerm.write('\b \b'); // Erase character
                    }
                }
                // Regular character
                else {
                    const commandBuffer = (currentTerm as any)._commandBuffer || '';
                    (currentTerm as any)._commandBuffer = commandBuffer + data;
                    currentTerm.write(data); // Local echo
                }
            });

            // Resize Logic
            const handleResize = () => {
                 const currentTerm = xtermRef.current;
                 if (!currentTerm?.element || !terminalRef.current) return;
                 if (terminalRef.current.offsetParent === null || terminalRef.current.clientHeight === 0) return;
                 try { fitAddon.fit(); } catch (e) {}
            }

            resizeObserver = new ResizeObserver(() => {
                 requestAnimationFrame(handleResize);
            });

            if (terminalRef.current) {
                 resizeObserver.observe(terminalRef.current);
            }

            setTimeout(handleResize, 200);
        } catch (error) {
            console.error('[Terminal] Initialization error:', error);
        } finally {
            isInitializing = false;
        }
    };

    initTerminal();

    return () => {
      isMounted = false;
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
      }
      if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Expose Write
  useEffect(() => {
    // Since xtermRef is populated async, we might need to check logic
    // But this effect runs every render.
    if (xtermRef.current) {
        (window as any)[`terminal_${sessionId}`] = xtermRef.current;
    }
  }, [sessionId, xtermRef.current]);

  // Theme Sync
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme;
    }
  }, [theme]);

  // For write helper
  useEffect(() => {
       const checkInterval = setInterval(() => {
           if (xtermRef.current) {
               (window as any)[`terminal_${sessionId}`] = xtermRef.current;
           }
       }, 500);
       return () => clearInterval(checkInterval);
  }, [sessionId]);

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full"
      style={{ padding: '8px' }}
    />
  );
}

export function writeToTerminal(sessionId: string, text: string) {
  const term = (window as any)[`terminal_${sessionId}`] as XTermType | undefined;
  if (term) {
    term.write(text.replace(/\n/g, '\r\n'));
  }
}

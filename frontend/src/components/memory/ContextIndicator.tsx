'use client';

import { useEffect, useState } from 'react';
import { useContextManager } from '@/lib/memory';
import { Brain, Clock, Zap, TrendingUp, Save, Database } from 'lucide-react';

interface ContextIndicatorProps {
  filePath: string;
  className?: string;
}

/**
 * Visual indicator showing remembered context when switching files
 */
export function ContextIndicator({ filePath, className = '' }: ContextIndicatorProps) {
  const { retrieveContext } = useContextManager();
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const loadContext = async () => {
      setLoading(true);
      try {
        const ctx = await retrieveContext(filePath);
        setContext(ctx);
        
        // Show indicator if there's meaningful context
        if (ctx.lastEditTime || ctx.relatedConversations.length > 0) {
          setShow(true);
          // Auto-hide after 5 seconds
          setTimeout(() => setShow(false), 5000);
        }
      } catch (error) {
        console.error('Failed to load context:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, [filePath, retrieveContext]);

  if (loading || !show || !context) return null;

  const timeSinceEdit = context.lastEditTime
    ? Math.round((Date.now() - context.lastEditTime.getTime()) / 60000)
    : null;

  return (
    <div className={`fixed top-16 right-4 z-50 ${className}`}>
      <div className="bg-purple-600/90 backdrop-blur-lg border border-purple-500/50 rounded-xl p-4 shadow-2xl max-w-sm animate-slide-in">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-purple-500/30 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white mb-1">
              Context Restored
            </h3>
            
            <div className="space-y-1.5">
              {timeSinceEdit !== null && (
                <div className="flex items-center space-x-2 text-xs text-purple-100">
                  <Clock className="w-3 h-3" />
                  <span>Last edited {timeSinceEdit}m ago</span>
                </div>
              )}
              
              {context.relatedConversations.length > 0 && (
                <div className="flex items-center space-x-2 text-xs text-purple-100">
                  <Zap className="w-3 h-3" />
                  <span>{context.relatedConversations.length} related conversations</span>
                </div>
              )}
              
              {context.relatedPatterns.length > 0 && (
                <div className="flex items-center space-x-2 text-xs text-purple-100">
                  <TrendingUp className="w-3 h-3" />
                  <span>{context.relatedPatterns.length} patterns available</span>
                </div>
              )}
              
              {context.emotionalContext.lastState && (
                <div className="flex items-center space-x-2 text-xs text-purple-100">
                  <Brain className="w-3 h-3" />
                  <span>Last state: {context.emotionalContext.lastState}</span>
                </div>
              )}
            </div>
            
            {context.suggestedContext && (
              <p className="mt-2 text-xs text-purple-200 leading-relaxed">
                {context.suggestedContext}
              </p>
            )}
          </div>

          <button
            onClick={() => setShow(false)}
            className="flex-shrink-0 text-purple-200 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Auto-save indicator
 */
export function AutoSaveIndicator() {
  const { autoSaveEnabled, lastAutoSave } = useContextManager();
  const [timeSince, setTimeSince] = useState<string>('');

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastAutoSave) {
        const seconds = Math.floor((Date.now() - lastAutoSave.getTime()) / 1000);
        if (seconds < 60) {
          setTimeSince(`${seconds}s ago`);
        } else {
          setTimeSince(`${Math.floor(seconds / 60)}m ago`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastAutoSave]);

  if (!autoSaveEnabled) return null;

  return (
    <div className="flex items-center space-x-2 text-xs text-gray-400">
      <Save className={`w-3 h-3 ${lastAutoSave ? 'text-green-400' : 'text-gray-500'}`} />
      <span>
        {lastAutoSave ? `Saved ${timeSince}` : 'Auto-save enabled'}
      </span>
    </div>
  );
}

/**
 * Memory statistics display
 */
export function MemoryStats() {
  const { getStats } = useContextManager();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const s = await getStats();
        setStats(s);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000); // Update every 30s

    return () => clearInterval(interval);
  }, [getStats]);

  if (loading || !stats) return null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
      <div className="flex items-center space-x-2 mb-3">
        <Database className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Memory Usage</h3>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Session</span>
          <span className="text-gray-300">
            {Math.round(stats.workingMemory.sessionDuration)}m • {stats.workingMemory.editsCount} edits
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Recent Files</span>
          <span className="text-gray-300">
            {stats.shortTermMemory.filesCount} files • {formatBytes(stats.shortTermMemory.storageSize)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Patterns</span>
          <span className="text-gray-300">
            {stats.longTermMemory.patternsCount} saved • {formatBytes(stats.longTermMemory.storageSize)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Focus timer with break suggestions
 */
export function FocusTimer() {
  const { workingMemory, startFocus, endFocus, suggestBreak, takeBreak } = useContextManager();
  const [focusTime, setFocusTime] = useState(0);
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);

  useEffect(() => {
    if (!workingMemory.focusStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - workingMemory.focusStartTime!.getTime()) / 1000);
      setFocusTime(elapsed);

      // Suggest break every 25 minutes (Pomodoro)
      if (elapsed > 0 && elapsed % (25 * 60) === 0) {
        setShowBreakSuggestion(true);
        suggestBreak();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [workingMemory.focusStartTime, suggestBreak]);

  const handleStartFocus = () => {
    startFocus();
    setFocusTime(0);
    setShowBreakSuggestion(false);
  };

  const handleTakeBreak = () => {
    takeBreak();
    endFocus();
    setShowBreakSuggestion(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (showBreakSuggestion) {
    return (
      <div className="bg-orange-600/20 border border-orange-500/30 rounded-lg p-3">
        <p className="text-sm text-orange-200 mb-2">
          You've been focused for 25 minutes. Time for a break?
        </p>
        <div className="flex space-x-2">
          <button
            onClick={handleTakeBreak}
            className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs text-white transition-colors"
          >
            Take Break
          </button>
          <button
            onClick={() => setShowBreakSuggestion(false)}
            className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
          >
            Keep Going
          </button>
        </div>
      </div>
    );
  }

  if (!workingMemory.focusStartTime) {
    return (
      <button
        onClick={handleStartFocus}
        className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition-colors flex items-center justify-center space-x-2"
      >
        <Zap className="w-4 h-4" />
        <span>Start Focus Session</span>
      </button>
    );
  }

  return (
    <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-purple-200">Focus Time</span>
        <span className="text-lg font-mono font-bold text-purple-100">
          {formatTime(focusTime)}
        </span>
      </div>
      <button
        onClick={() => endFocus()}
        className="w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
      >
        End Session
      </button>
    </div>
  );
}

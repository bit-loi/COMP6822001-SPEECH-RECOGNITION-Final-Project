import { create } from 'zustand';
import { 
  WorkingMemory, 
  ShortTermMemory, 
  LongTermMemory,
  EditAction,
  ConversationMessage,
  ContextRetrieval,
  MemoryStats,
  MemoryExport,
  FileEditHistory,
  ProblemSolved,
  LearnedPattern,
} from './types';
import { EmotionalAnalysis } from '@/lib/gemini';
import { getShortTermStorage } from './shortTermStorage';
import { getLongTermStorage } from './longTermStorage';

/**
 * Context Manager State
 */
interface ContextManagerState {
  // Working Memory
  workingMemory: WorkingMemory;
  
  // Auto-save
  autoSaveEnabled: boolean;
  lastAutoSave: Date | null;
  
  // Actions - Working Memory
  startSession: () => void;
  endSession: () => void;
  setCurrentFile: (path: string, content: string, language: string) => void;
  addEdit: (edit: Omit<EditAction, 'id' | 'timestamp'>) => void;
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void;
  updateEmotionalState: (state: EmotionalAnalysis) => void;
  startFocus: () => void;
  endFocus: () => void;
  suggestBreak: () => void;
  takeBreak: () => void;
  
  // Actions - Short-term Memory
  saveFileHistory: (file: FileEditHistory) => Promise<void>;
  saveProblem: (problem: Omit<ProblemSolved, 'id' | 'timestamp'>) => Promise<void>;
  savePattern: (pattern: Omit<LearnedPattern, 'id' | 'timestamp'>) => Promise<void>;
  getRecentFiles: () => Promise<FileEditHistory[]>;
  
  // Actions - Long-term Memory
  updateCodingStyle: (style: any) => void;
  addCommonPattern: (pattern: any) => void;
  
  // Context Retrieval
  retrieveContext: (filePath: string) => Promise<ContextRetrieval>;
  
  // Auto-save
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  manualSave: () => Promise<void>;
  
  // Export/Import
  exportMemory: () => Promise<MemoryExport>;
  importMemory: (data: MemoryExport) => Promise<void>;
  
  // Statistics
  getStats: () => Promise<MemoryStats>;
  
  // Cleanup
  cleanup: () => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default working memory
 */
function getDefaultWorkingMemory(): WorkingMemory {
  return {
    sessionId: generateId(),
    sessionStartTime: new Date(),
    currentFile: null,
    recentEdits: [],
    activeConversation: [],
    emotionalState: null,
    focusStartTime: null,
    breaksSuggested: 0,
    breaksActuallyTaken: 0,
  };
}

/**
 * Context Manager Store
 */
export const useContextManager = create<ContextManagerState>((set, get) => {
  let autoSaveInterval: NodeJS.Timeout | null = null;

  // Initialize auto-save
  const startAutoSave = () => {
    if (autoSaveInterval) return;
    
    autoSaveInterval = setInterval(async () => {
      const state = get();
      if (state.autoSaveEnabled) {
        await state.manualSave();
      }
    }, 30000); // 30 seconds
  };

  const stopAutoSave = () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }
  };

  return {
    // Initial state
    workingMemory: getDefaultWorkingMemory(),
    autoSaveEnabled: true,
    lastAutoSave: null,

    // Start new session
    startSession: () => {
      set({
        workingMemory: getDefaultWorkingMemory(),
      });
      startAutoSave();
    },

    // End session
    endSession: async () => {
      const { workingMemory, manualSave } = get();
      
      // Save final state
      await manualSave();
      
      // Update long-term stats
      const sessionDuration = (Date.now() - workingMemory.sessionStartTime.getTime()) / 60000;
      const longTerm = getLongTermStorage();
      
      longTerm.updateSessionStats({
        sessionTime: sessionDuration,
        breaksTaken: workingMemory.breaksActuallyTaken,
        focusTime: sessionDuration / (workingMemory.breaksActuallyTaken + 1),
        workingHour: new Date().getHours(),
      });

      stopAutoSave();
    },

    // Set current file
    setCurrentFile: (path, content, language) => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          currentFile: {
            path,
            content,
            language,
            lastModified: new Date(),
          },
        },
      }));
    },

    // Add edit action
    addEdit: (edit) => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          recentEdits: [
            {
              ...edit,
              id: generateId(),
              timestamp: new Date(),
            },
            ...state.workingMemory.recentEdits,
          ].slice(0, 10), // Keep last 10
        },
      }));
    },

    // Add conversation message
    addMessage: (message) => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          activeConversation: [
            ...state.workingMemory.activeConversation,
            {
              ...message,
              id: generateId(),
              timestamp: new Date(),
            },
          ],
        },
      }));
    },

    // Update emotional state
    updateEmotionalState: (emotionalState) => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          emotionalState,
        },
      }));

      // Save to long-term
      const longTerm = getLongTermStorage();
      longTerm.addEmotionalPattern({
        date: new Date(),
        state: emotionalState.emotionalState,
        intensity: emotionalState.intensity,
        cognitiveLoad: emotionalState.cognitiveLoad,
        triggers: emotionalState.indicators,
        duration: 0, // Will be updated on focus end
      });
    },

    // Start focus session
    startFocus: () => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          focusStartTime: new Date(),
        },
      }));
    },

    // End focus session
    endFocus: () => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          focusStartTime: null,
        },
      }));
    },

    // Suggest break
    suggestBreak: () => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          breaksSuggested: state.workingMemory.breaksSuggested + 1,
        },
      }));
    },

    // Take break
    takeBreak: () => {
      set((state) => ({
        workingMemory: {
          ...state.workingMemory,
          breaksActuallyTaken: state.workingMemory.breaksActuallyTaken + 1,
        },
      }));
    },

    // Save file history to short-term
    saveFileHistory: async (file) => {
      const storage = getShortTermStorage();
      await storage.saveFileHistory(file);
    },

    // Save problem to short-term
    saveProblem: async (problem) => {
      const storage = getShortTermStorage();
      await storage.saveProblem({
        ...problem,
        id: generateId(),
        timestamp: new Date(),
      });
    },

    // Save pattern to short-term
    savePattern: async (pattern) => {
      const storage = getShortTermStorage();
      await storage.savePattern({
        ...pattern,
        id: generateId(),
        timestamp: new Date(),
        lastUsed: new Date(),
      });
    },

    // Get recent files
    getRecentFiles: async () => {
      const storage = getShortTermStorage();
      return await storage.getRecentFiles(24);
    },

    // Update coding style
    updateCodingStyle: (style) => {
      const longTerm = getLongTermStorage();
      longTerm.updateCodingStyle(style);
    },

    // Add common pattern
    addCommonPattern: (pattern) => {
      const longTerm = getLongTermStorage();
      longTerm.addPattern(pattern);
    },

    // Retrieve context for file
    retrieveContext: async (filePath) => {
      const shortTerm = getShortTermStorage();
      const longTerm = getLongTermStorage();

      // Get file history
      const fileHistory = await shortTerm.getFileHistory(filePath);

      // Get related conversations
      const { workingMemory } = get();
      const relatedConversations = workingMemory.activeConversation.filter(
        msg => msg.context?.filePath === filePath
      );

      // Get related patterns
      const memory = longTerm.load();
      const relatedPatterns = memory?.commonPatterns.filter(
        p => p.tags.some(tag => filePath.includes(tag))
      ) || [];

      // Build suggested context
      let suggestedContext = '';
      if (fileHistory) {
        suggestedContext += `Last edited ${Math.round((Date.now() - fileHistory.lastEdited.getTime()) / 60000)} minutes ago. `;
        suggestedContext += `${fileHistory.editCount} edits made. `;
      }
      if (relatedConversations.length > 0) {
        suggestedContext += `${relatedConversations.length} related conversations. `;
      }

      // Get emotional context
      const emotionalPatterns = memory?.emotionalPatterns.filter(
        p => Math.abs(p.date.getTime() - Date.now()) < 24 * 60 * 60 * 1000
      ) || [];
      
      const avgLoad = emotionalPatterns.length > 0
        ? emotionalPatterns.reduce((sum, p) => sum + p.cognitiveLoad, 0) / emotionalPatterns.length
        : 0;

      return {
        filePath,
        lastContent: fileHistory?.lastContent || null,
        lastEditTime: fileHistory?.lastEdited || null,
        relatedConversations,
        relatedPatterns,
        suggestedContext,
        emotionalContext: {
          lastState: emotionalPatterns[emotionalPatterns.length - 1]?.state || null,
          averageLoad: avgLoad,
        },
      };
    },

    // Enable auto-save
    enableAutoSave: () => {
      set({ autoSaveEnabled: true });
      startAutoSave();
    },

    // Disable auto-save
    disableAutoSave: () => {
      set({ autoSaveEnabled: false });
      stopAutoSave();
    },

    // Manual save
    manualSave: async () => {
      const { workingMemory } = get();
      const shortTerm = getShortTermStorage();

      // Save current file to short-term
      if (workingMemory.currentFile) {
        await shortTerm.saveFileHistory({
          filePath: workingMemory.currentFile.path,
          language: workingMemory.currentFile.language,
          lastEdited: new Date(),
          editCount: workingMemory.recentEdits.filter(
            e => e.filePath === workingMemory.currentFile!.path
          ).length,
          timeSpent: 0, // TODO: Calculate
          linesAdded: 0, // TODO: Calculate
          linesDeleted: 0, // TODO: Calculate
          lastContent: workingMemory.currentFile.content,
        });
      }

      set({ lastAutoSave: new Date() });
    },

    // Export all memory
    exportMemory: async () => {
      const { workingMemory } = get();
      const shortTerm = getShortTermStorage();
      const longTerm = getLongTermStorage();

      const shortTermMemory = await shortTerm.getAll();
      const longTermMemory = longTerm.load() || {} as LongTermMemory;

      return {
        version: '1.0.0',
        exportDate: new Date(),
        workingMemory,
        shortTermMemory,
        longTermMemory,
      };
    },

    // Import memory
    importMemory: async (data) => {
      // TODO: Implement import logic
      console.log('Import not yet implemented', data);
    },

    // Get statistics
    getStats: async () => {
      const { workingMemory } = get();
      const shortTerm = getShortTermStorage();
      const longTerm = getLongTermStorage();

      const sessionDuration = (Date.now() - workingMemory.sessionStartTime.getTime()) / 60000;
      
      const shortTermMemory = await shortTerm.getAll();
      const shortTermSize = await shortTerm.getStorageSize();
      const longTermSize = longTerm.getStorageSize();

      return {
        workingMemory: {
          sessionDuration,
          editsCount: workingMemory.recentEdits.length,
          conversationLength: workingMemory.activeConversation.length,
        },
        shortTermMemory: {
          filesCount: shortTermMemory.filesEdited.length,
          problemsCount: shortTermMemory.problemsSolved.length,
          patternsCount: shortTermMemory.patternsLearned.length,
          storageSize: shortTermSize,
        },
        longTermMemory: {
          patternsCount: longTerm.load()?.commonPatterns.length || 0,
          emotionalRecordsCount: longTerm.load()?.emotionalPatterns.length || 0,
          storageSize: longTermSize,
        },
      };
    },

    // Cleanup old data
    cleanup: async () => {
      const shortTerm = getShortTermStorage();
      await shortTerm.cleanup(7); // Keep 7 days
    },

    // Clear all memory
    clearAll: async () => {
      const shortTerm = getShortTermStorage();
      const longTerm = getLongTermStorage();

      await shortTerm.clear();
      longTerm.clear();
      
      set({
        workingMemory: getDefaultWorkingMemory(),
        lastAutoSave: null,
      });
    },
  };
});

// Initialize auto-save on mount
if (typeof window !== 'undefined') {
  useContextManager.getState().enableAutoSave();
}

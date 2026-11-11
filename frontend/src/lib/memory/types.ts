import { EmotionalAnalysis } from '@/lib/gemini';

/**
 * Edit action types
 */
export type EditActionType = 'insert' | 'delete' | 'replace' | 'format';

/**
 * Single edit action in working memory
 */
export interface EditAction {
  id: string;
  type: EditActionType;
  timestamp: Date;
  filePath: string;
  position: {
    line: number;
    column: number;
  };
  content: string;
  previousContent?: string;
}

/**
 * AI conversation message
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    filePath: string;
    codeSnippet?: string;
  };
}

/**
 * Working Memory - Current active session
 */
export interface WorkingMemory {
  sessionId: string;
  sessionStartTime: Date;
  currentFile: {
    path: string;
    content: string;
    language: string;
    lastModified: Date;
  } | null;
  recentEdits: EditAction[];
  activeConversation: ConversationMessage[];
  emotionalState: EmotionalAnalysis | null;
  focusStartTime: Date | null;
  breaksSuggested: number;
  breaksActuallyTaken: number;
}

/**
 * File edit history for short-term memory
 */
export interface FileEditHistory {
  filePath: string;
  language: string;
  lastEdited: Date;
  editCount: number;
  timeSpent: number; // in seconds
  linesAdded: number;
  linesDeleted: number;
  lastContent: string;
}

/**
 * Problem solved record
 */
export interface ProblemSolved {
  id: string;
  timestamp: Date;
  problem: string;
  solution: string;
  filePath: string;
  emotionalStateBefore: string;
  emotionalStateAfter: string;
  timeToSolve: number; // in minutes
}

/**
 * Pattern learned during session
 */
export interface LearnedPattern {
  id: string;
  timestamp: Date;
  pattern: string;
  context: string;
  frequency: number;
  lastUsed: Date;
}

/**
 * Short-term Memory - Recent work (24 hours)
 */
export interface ShortTermMemory {
  filesEdited: FileEditHistory[];
  problemsSolved: ProblemSolved[];
  patternsLearned: LearnedPattern[];
  lastUpdated: Date;
}

/**
 * Project structure understanding
 */
export interface ProjectStructure {
  rootPath: string;
  fileTree: {
    [path: string]: {
      type: 'file' | 'folder';
      language?: string;
      size: number;
      lastModified: Date;
    };
  };
  dependencies: string[];
  framework?: string;
  lastAnalyzed: Date;
}

/**
 * Coding style preferences
 */
export interface CodingStyle {
  indentation: 'tabs' | 'spaces';
  indentSize: number;
  quotes: 'single' | 'double';
  semicolons: boolean;
  trailingComma: boolean;
  bracketSpacing: boolean;
  arrowParens: 'always' | 'avoid';
}

/**
 * Emotional pattern over time
 */
export interface EmotionalPattern {
  date: Date;
  state: string;
  intensity: number;
  cognitiveLoad: number;
  triggers: string[];
  duration: number; // in minutes
}

/**
 * Common pattern user follows
 */
export interface CommonPattern {
  id: string;
  name: string;
  description: string;
  code: string;
  usageCount: number;
  lastUsed: Date;
  tags: string[];
}

/**
 * Long-term Memory - Project context
 */
export interface LongTermMemory {
  projectStructure: ProjectStructure | null;
  commonPatterns: CommonPattern[];
  codingStyle: CodingStyle;
  emotionalPatterns: EmotionalPattern[];
  totalSessionTime: number; // in minutes
  totalBreaksTaken: number;
  averageFocusTime: number; // in minutes
  preferredWorkingHours: number[]; // hours of day (0-23)
  lastUpdated: Date;
}

/**
 * Memory export format
 */
export interface MemoryExport {
  version: string;
  exportDate: Date;
  workingMemory: WorkingMemory;
  shortTermMemory: ShortTermMemory;
  longTermMemory: LongTermMemory;
}

/**
 * Context retrieval result
 */
export interface ContextRetrieval {
  filePath: string;
  lastContent: string | null;
  lastEditTime: Date | null;
  relatedConversations: ConversationMessage[];
  relatedPatterns: CommonPattern[];
  suggestedContext: string;
  emotionalContext: {
    lastState: string | null;
    averageLoad: number;
  };
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  workingMemory: {
    sessionDuration: number; // in minutes
    editsCount: number;
    conversationLength: number;
  };
  shortTermMemory: {
    filesCount: number;
    problemsCount: number;
    patternsCount: number;
    storageSize: number; // in bytes
  };
  longTermMemory: {
    patternsCount: number;
    emotionalRecordsCount: number;
    storageSize: number; // in bytes
  };
}

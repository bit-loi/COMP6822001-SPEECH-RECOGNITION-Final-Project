/**
 * AmbatuCode Memory System
 * 
 * Three-tier memory system to reduce context switching for developers returning to a project during recovery
 */

// Main Context Manager
export { useContextManager } from './contextManager';

// Storage layers
export { getShortTermStorage, ShortTermStorage } from './shortTermStorage';
export { getLongTermStorage, LongTermStorage } from './longTermStorage';

// Types
export type {
  WorkingMemory,
  ShortTermMemory,
  LongTermMemory,
  EditAction,
  EditActionType,
  ConversationMessage,
  FileEditHistory,
  ProblemSolved,
  LearnedPattern,
  ProjectStructure,
  CodingStyle,
  EmotionalPattern,
  CommonPattern,
  ContextRetrieval,
  MemoryStats,
  MemoryExport,
} from './types';

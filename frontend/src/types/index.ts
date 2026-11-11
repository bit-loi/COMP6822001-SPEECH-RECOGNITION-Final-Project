/**
 * Core type definitions for AmbatuCode
 */

// Emotional States
export type EmotionalState =
  | "flow"
  | "focused"
  | "frustrated"
  | "confused"
  | "tired"
  | "neutral";

export interface EmotionalStateData {
  state: EmotionalState;
  confidence: number;
  timestamp: number;
  duration: number;
}

// Editor Configuration
export interface EditorConfig {
  theme: "light" | "dark" | "high-contrast";
  fontSize: number;
  fontFamily: "default" | "dyslexic" | "mono";
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  bracketPairColorization: boolean;
  semanticHighlighting: boolean;
}

// Sensory Settings
export interface SensorySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  focusMode: boolean;
  soundEnabled: boolean;
  hapticFeedback: boolean;
  colorBlindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
}

// Task Management
export interface Task {
  id: string;
  title: string;
  description: string;
  subtasks: SubTask[];
  priority: "low" | "medium" | "high";
  estimatedTime: number;
  actualTime: number;
  status: "todo" | "in-progress" | "completed" | "blocked";
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

// Memory System
export interface WorkingMemory {
  id: string;
  content: string;
  type: "code" | "note" | "reference" | "error";
  timestamp: number;
  relevance: number;
}

export interface ShortTermMemory {
  id: string;
  sessionId: string;
  files: string[];
  tasks: Task[];
  emotionalStates: EmotionalStateData[];
  startTime: number;
  endTime?: number;
}

export interface LongTermMemory {
  id: string;
  patterns: CodePattern[];
  preferences: UserPreferences;
  achievements: Achievement[];
  insights: Insight[];
}

export interface CodePattern {
  id: string;
  pattern: string;
  frequency: number;
  context: string;
  lastUsed: number;
}

// User Preferences
export interface UserPreferences {
  editorConfig: EditorConfig;
  sensorySettings: SensorySettings;
  breakReminders: boolean;
  breakInterval: number;
  focusSessionDuration: number;
  aiAssistanceLevel: "minimal" | "moderate" | "maximum";
  notificationPreferences: NotificationPreferences;
}

export interface NotificationPreferences {
  enabled: boolean;
  breakReminders: boolean;
  taskReminders: boolean;
  emotionalStateAlerts: boolean;
  achievementNotifications: boolean;
}

// Wellbeing Monitoring
export interface WellbeingMetrics {
  sessionDuration: number;
  breaksTaken: number;
  focusScore: number;
  frustrationLevel: number;
  productivityScore: number;
  lastBreak: number;
  emotionalStateHistory: EmotionalStateData[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: number;
  category: "productivity" | "wellbeing" | "learning" | "milestone";
}

export interface Insight {
  id: string;
  type: "pattern" | "suggestion" | "warning" | "tip";
  title: string;
  description: string;
  actionable: boolean;
  action?: string;
  timestamp: number;
}

// AI Features
export interface AIContext {
  currentFile: string;
  recentFiles: string[];
  currentTask?: Task;
  emotionalState: EmotionalState;
  codeContext: string;
  userQuery: string;
}

export interface AIResponse {
  type: "explanation" | "suggestion" | "breakdown" | "error-help";
  content: string;
  codeSnippets?: CodeSnippet[];
  relatedTasks?: Task[];
  confidence: number;
}

export interface CodeSnippet {
  language: string;
  code: string;
  explanation: string;
}

// File System
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  content?: string;
  language?: string;
  lastModified: number;
}

// Session Management
export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  files: string[];
  tasks: Task[];
  wellbeingMetrics: WellbeingMetrics;
  emotionalStateHistory: EmotionalStateData[];
}

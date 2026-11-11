/**
 * Configuration constants for Neuravity
 */

export const APP_CONFIG = {
  name: "Neuravity",
  version: "0.1.0",
  description: "A neurodivergent-friendly code editor",
} as const;

export const AI_CONFIG = {
  model: "gemini-2.0-flash-exp",
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.95,
} as const;

export const EDITOR_CONFIG = {
  defaultTheme: "vs-dark",
  defaultFontSize: 14,
  defaultTabSize: 2,
  defaultLineHeight: 1.6,
  supportedLanguages: [
    "typescript",
    "javascript",
    "python",
    "java",
    "cpp",
    "csharp",
    "go",
    "rust",
    "html",
    "css",
    "json",
    "markdown",
  ],
} as const;

export const WELLBEING_CONFIG = {
  defaultBreakInterval: 25 * 60, // 25 minutes in seconds (Pomodoro)
  defaultFocusSessionDuration: 50 * 60, // 50 minutes
  minBreakDuration: 5 * 60, // 5 minutes
  recommendedBreakDuration: 10 * 60, // 10 minutes
  maxContinuousWorkTime: 90 * 60, // 90 minutes
} as const;

export const EMOTIONAL_STATES = {
  flow: {
    label: "Flow State",
    description: "Deep focus and productivity",
    color: "hsl(142, 76%, 36%)",
    icon: "🌊",
  },
  focused: {
    label: "Focused",
    description: "Concentrated work",
    color: "hsl(217, 91%, 60%)",
    icon: "🎯",
  },
  frustrated: {
    label: "Frustrated",
    description: "Experiencing difficulties",
    color: "hsl(25, 95%, 53%)",
    icon: "😤",
  },
  confused: {
    label: "Confused",
    description: "Uncertain or unclear",
    color: "hsl(45, 93%, 47%)",
    icon: "🤔",
  },
  tired: {
    label: "Tired",
    description: "Low energy or fatigue",
    color: "hsl(262, 52%, 47%)",
    icon: "😴",
  },
  neutral: {
    label: "Neutral",
    description: "Normal working state",
    color: "hsl(215, 20%, 65%)",
    icon: "😐",
  },
} as const;

export const STORAGE_KEYS = {
  editorConfig: "neuravity-editor-config",
  sensorySettings: "neuravity-sensory-settings",
  tasks: "neuravity-tasks",
  userPreferences: "neuravity-user-preferences",
  sessions: "neuravity-sessions",
  achievements: "neuravity-achievements",
} as const;

export const FEATURE_FLAGS = {
  enableAI: process.env.NEXT_PUBLIC_ENABLE_AI_FEATURES !== "false",
  enableEmotionDetection:
    process.env.NEXT_PUBLIC_ENABLE_EMOTION_DETECTION !== "false",
  enableWellbeingMonitoring:
    process.env.NEXT_PUBLIC_ENABLE_WELLBEING_MONITORING !== "false",
} as const;

export const ACCESSIBILITY_CONFIG = {
  minFontSize: 12,
  maxFontSize: 24,
  minLineHeight: 1.2,
  maxLineHeight: 2.0,
  minContrast: 4.5, // WCAG AA
  recommendedContrast: 7.0, // WCAG AAA
} as const;

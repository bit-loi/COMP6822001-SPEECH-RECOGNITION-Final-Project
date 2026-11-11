/**
 * Zustand Store for Neuravity
 * Manages global application state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  EditorConfig,
  SensorySettings,
  Task,
  EmotionalStateData,
  WellbeingMetrics,
  UserPreferences,
  Session,
} from "@/types";

interface AppState {
  // Editor State
  editorConfig: EditorConfig;
  updateEditorConfig: (config: Partial<EditorConfig>) => void;

  // Sensory Settings
  sensorySettings: SensorySettings;
  updateSensorySettings: (settings: Partial<SensorySettings>) => void;

  // Tasks
  tasks: Task[];
  currentTask: Task | null;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setCurrentTask: (task: Task | null) => void;

  // Emotional State
  currentEmotionalState: EmotionalStateData | null;
  emotionalStateHistory: EmotionalStateData[];
  updateEmotionalState: (state: EmotionalStateData) => void;

  // Wellbeing
  wellbeingMetrics: WellbeingMetrics;
  updateWellbeingMetrics: (metrics: Partial<WellbeingMetrics>) => void;
  recordBreak: () => void;

  // Session
  currentSession: Session | null;
  startSession: () => void;
  endSession: () => void;

  // User Preferences
  userPreferences: UserPreferences;
  updateUserPreferences: (prefs: Partial<UserPreferences>) => void;
}

const defaultEditorConfig: EditorConfig = {
  theme: "dark",
  fontSize: 14,
  fontFamily: "default",
  lineHeight: 1.6,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  lineNumbers: true,
  bracketPairColorization: true,
  semanticHighlighting: true,
};

const defaultSensorySettings: SensorySettings = {
  reducedMotion: false,
  highContrast: false,
  focusMode: false,
  soundEnabled: true,
  hapticFeedback: false,
  colorBlindMode: "none",
};

const defaultWellbeingMetrics: WellbeingMetrics = {
  sessionDuration: 0,
  breaksTaken: 0,
  focusScore: 0,
  frustrationLevel: 0,
  productivityScore: 0,
  lastBreak: Date.now(),
  emotionalStateHistory: [],
};

const defaultUserPreferences: UserPreferences = {
  editorConfig: defaultEditorConfig,
  sensorySettings: defaultSensorySettings,
  breakReminders: true,
  breakInterval: 25 * 60, // 25 minutes in seconds
  focusSessionDuration: 50 * 60, // 50 minutes in seconds
  aiAssistanceLevel: "moderate",
  notificationPreferences: {
    enabled: true,
    breakReminders: true,
    taskReminders: true,
    emotionalStateAlerts: true,
    achievementNotifications: true,
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Editor Config
      editorConfig: defaultEditorConfig,
      updateEditorConfig: (config) =>
        set((state) => ({
          editorConfig: { ...state.editorConfig, ...config },
        })),

      // Sensory Settings
      sensorySettings: defaultSensorySettings,
      updateSensorySettings: (settings) =>
        set((state) => ({
          sensorySettings: { ...state.sensorySettings, ...settings },
        })),

      // Tasks
      tasks: [],
      currentTask: null,
      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, task],
        })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, ...updates, updatedAt: Date.now() }
              : task
          ),
        })),
      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),
      setCurrentTask: (task) => set({ currentTask: task }),

      // Emotional State
      currentEmotionalState: null,
      emotionalStateHistory: [],
      updateEmotionalState: (state) =>
        set((prevState) => ({
          currentEmotionalState: state,
          emotionalStateHistory: [
            ...prevState.emotionalStateHistory.slice(-99), // Keep last 100
            state,
          ],
        })),

      // Wellbeing
      wellbeingMetrics: defaultWellbeingMetrics,
      updateWellbeingMetrics: (metrics) =>
        set((state) => ({
          wellbeingMetrics: { ...state.wellbeingMetrics, ...metrics },
        })),
      recordBreak: () =>
        set((state) => ({
          wellbeingMetrics: {
            ...state.wellbeingMetrics,
            breaksTaken: state.wellbeingMetrics.breaksTaken + 1,
            lastBreak: Date.now(),
          },
        })),

      // Session
      currentSession: null,
      startSession: () => {
        const session: Session = {
          id: `session-${Date.now()}`,
          startTime: Date.now(),
          files: [],
          tasks: get().tasks,
          wellbeingMetrics: defaultWellbeingMetrics,
          emotionalStateHistory: [],
        };
        set({ currentSession: session });
      },
      endSession: () =>
        set((state) => ({
          currentSession: state.currentSession
            ? { ...state.currentSession, endTime: Date.now() }
            : null,
        })),

      // User Preferences
      userPreferences: defaultUserPreferences,
      updateUserPreferences: (prefs) =>
        set((state) => ({
          userPreferences: { ...state.userPreferences, ...prefs },
        })),
    }),
    {
      name: "neuravity-storage",
      partialize: (state) => ({
        editorConfig: state.editorConfig,
        sensorySettings: state.sensorySettings,
        tasks: state.tasks,
        userPreferences: state.userPreferences,
      }),
    }
  )
);

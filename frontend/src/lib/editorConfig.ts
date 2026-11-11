/**
 * Monaco Editor Configuration for Neurodivergent-Friendly Features
 */

import type { editor } from "monaco-editor";

export interface NeurodivergentEditorSettings {
  // ADHD Support
  focusMode: boolean;
  pomodoroEnabled: boolean;
  pomodoroWorkDuration: number; // minutes
  pomodoroBreakDuration: number; // minutes
  showTaskChunking: boolean;
  showTimeEstimates: boolean;

  // Autism Support
  reducedVisualNoise: boolean;
  disablePopups: boolean;
  colorScheme: "default" | "low-contrast" | "high-contrast";
  minimalistUI: boolean;

  // Dyslexia Support
  useDyslexicFont: boolean;
  increasedLetterSpacing: boolean;
  customLineHeight: number;
  enhancedSyntaxColors: boolean;

  // General
  fontSize: number;
  theme: "light" | "dark" | "high-contrast-dark" | "high-contrast-light";
  uiLanguage: "en" | "id" | "es" | "ja" | "fr" | "de" | "zh" | "ko" | "ar" | "ru" | "pt" | "it";
}

export const defaultNeurodivergentSettings: NeurodivergentEditorSettings = {
  // ADHD
  focusMode: false,
  pomodoroEnabled: false,
  pomodoroWorkDuration: 25,
  pomodoroBreakDuration: 5,
  showTaskChunking: true,
  showTimeEstimates: true,

  // Autism
  reducedVisualNoise: false,
  disablePopups: false,
  colorScheme: "default",
  minimalistUI: false,

  // Dyslexia
  useDyslexicFont: false,
  increasedLetterSpacing: false,
  customLineHeight: 1.6,
  enhancedSyntaxColors: false,

  // General
  fontSize: 14,
  theme: "dark",
  uiLanguage: "en",
};

export function getMonacoOptions(
  settings: NeurodivergentEditorSettings
): editor.IStandaloneEditorConstructionOptions {
  const baseOptions: editor.IStandaloneEditorConstructionOptions = {
    fontSize: settings.fontSize,
    lineHeight: settings.customLineHeight * settings.fontSize,
    fontFamily: settings.useDyslexicFont
      ? "'OpenDyslexic', 'Comic Sans MS', monospace"
      : "'Geist Mono', 'Consolas', 'Courier New', monospace",
    letterSpacing: settings.increasedLetterSpacing ? 0.5 : 0,
    
    // Minimap
    minimap: {
      enabled: !settings.minimalistUI && !settings.reducedVisualNoise,
    },

    // Line numbers
    lineNumbers: "on",
    lineNumbersMinChars: settings.minimalistUI ? 3 : 5,

    // Scrollbar
    scrollbar: {
      vertical: "auto",
      horizontal: "auto",
      verticalScrollbarSize: settings.minimalistUI ? 8 : 14,
      horizontalScrollbarSize: settings.minimalistUI ? 8 : 14,
    },

    // Suggestions
    quickSuggestions: !settings.disablePopups,
    suggestOnTriggerCharacters: !settings.disablePopups,
    parameterHints: {
      enabled: !settings.disablePopups,
    },

    // Visual
    renderLineHighlight: settings.focusMode ? "all" : "line",
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    smoothScrolling: true,

    // Bracket pair colorization
    bracketPairColorization: {
      enabled: settings.enhancedSyntaxColors,
    },

    // Word wrap
    wordWrap: "on",
    wrappingIndent: "indent",

    // Padding
    padding: {
      top: settings.minimalistUI ? 8 : 16,
      bottom: settings.minimalistUI ? 8 : 16,
    },

    // Other
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    folding: !settings.minimalistUI,
    glyphMargin: !settings.minimalistUI,
    renderWhitespace: settings.reducedVisualNoise ? "none" : "selection",
  };

  return baseOptions;
}

export function getThemeName(
  theme: NeurodivergentEditorSettings["theme"]
): string {
  switch (theme) {
    case "light":
      return "vs";
    case "dark":
      return "vs-dark";
    case "high-contrast-dark":
      return "hc-black";
    case "high-contrast-light":
      return "hc-light";
    default:
      return "vs-dark";
  }
}

export const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
] as const;

export const STORAGE_KEY = "ambatucode-editor-settings";

export function saveSettings(settings: NeurodivergentEditorSettings): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      // Silent fail - localStorage might be disabled
    }
  }
}

export function loadSettings(): NeurodivergentEditorSettings {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultNeurodivergentSettings, ...JSON.parse(saved) };
      }
    } catch (error) {
      // Silent fail - return defaults
    }
  }
  return defaultNeurodivergentSettings;
}

"use client";

import { useRef, useState, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import {
  getMonacoOptions,
  getThemeName,
  loadSettings,
  type NeurodivergentEditorSettings,
} from "@/lib/editorConfig";
import { FocusMode, PomodoroTimer } from "./FocusMode";

interface MonacoEditorProps {
  defaultValue?: string;
  defaultLanguage?: string;
  onChange?: (value: string | undefined) => void;
  settings: NeurodivergentEditorSettings;
}

export function MonacoEditor({
  defaultValue = "// Start coding...\n",
  defaultLanguage = "typescript",
  onChange,
  settings,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [currentLine, setCurrentLine] = useState(1);
  const [totalLines, setTotalLines] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position for focus mode
    editor.onDidChangeCursorPosition((e) => {
      setCurrentLine(e.position.lineNumber);
    });

    // Track total lines
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model) {
        setTotalLines(model.getLineCount());
      }
    });

    // Set initial line count
    const model = editor.getModel();
    if (model) {
      setTotalLines(model.getLineCount());
    }

    // Focus the editor
    editor.focus();

    // Custom theme for dyslexia-friendly colors
    if (settings.enhancedSyntaxColors) {
      monaco.editor.defineTheme("dyslexia-friendly", {
        base: settings.theme === "light" ? "vs" : "vs-dark",
        inherit: true,
        rules: [
          { token: "comment", foreground: "6A9955", fontStyle: "italic" },
          { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
          { token: "string", foreground: "CE9178" },
          { token: "number", foreground: "B5CEA8" },
          { token: "function", foreground: "DCDCAA" },
          { token: "variable", foreground: "9CDCFE" },
        ],
        colors: {},
      });
      monaco.editor.setTheme("dyslexia-friendly");
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    onChange?.(value);
  };

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  const monacoOptions = getMonacoOptions(settings);
  const themeName = settings.enhancedSyntaxColors
    ? "dyslexia-friendly"
    : getThemeName(settings.theme);

  return (
    <div className="relative h-full w-full">
      {/* Focus Mode Overlay */}
      {settings.focusMode && (
        <FocusMode
          enabled={settings.focusMode}
          currentLine={currentLine}
          totalLines={totalLines}
        />
      )}

      {/* Monaco Editor */}
      <Editor
        height="100%"
        defaultLanguage={defaultLanguage}
        defaultValue={defaultValue}
        theme={themeName}
        options={monacoOptions}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        loading={
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground">Loading editor...</div>
          </div>
        }
      />

      {/* Pomodoro Timer */}
      {settings.pomodoroEnabled && (
        <PomodoroTimer
          enabled={settings.pomodoroEnabled}
          workDuration={settings.pomodoroWorkDuration}
          breakDuration={settings.pomodoroBreakDuration}
          onBreakTime={() => {
            // Could show a toast notification here
          }}
        />
      )}
    </div>
  );
}

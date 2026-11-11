"use client";

import { useState } from "react";
import {
  defaultAccessibilitySettings,
  saveSettings,
  loadSettings,
  type AccessibilityEditorSettings,
} from "@/lib/editorConfig";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Eye,
  Timer,
  Type,
  LayoutPanelLeft,
  Sparkles,
  RotateCcw,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslation, type Language } from "@/lib/translations";

interface CustomizationsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AccessibilityEditorSettings;
  onSettingsChange: (settings: AccessibilityEditorSettings) => void;
}

type Section = "focus" | "reading" | "visual" | "pomodoro" | "panels" | "font" | "language";

interface SectionMeta {
  id: Section;
  icon: React.ReactNode;
  label: string;
  description: string;
}

const SECTIONS: SectionMeta[] = [
  {
    id: "focus",
    icon: <Brain className="w-4 h-4" />,
    label: "Focus & Low Energy",
    description: "Reduce distraction",
  },
  {
    id: "reading",
    icon: <Type className="w-4 h-4" />,
    label: "Reading Comfort",
    description: "Font & spacing",
  },
  {
    id: "visual",
    icon: <Eye className="w-4 h-4" />,
    label: "Visual Comfort",
    description: "Colors & noise",
  },
  {
    id: "pomodoro",
    icon: <Timer className="w-4 h-4" />,
    label: "Pomodoro Timer",
    description: "Work/break cycles",
  },
  {
    id: "panels",
    icon: <LayoutPanelLeft className="w-4 h-4" />,
    label: "Layout",
    description: "Show/hide panels",
  },
  {
    id: "font",
    icon: <Sparkles className="w-4 h-4" />,
    label: "Font Size",
    description: "Text size",
  },
  {
    id: "language",
    icon: <Globe className="w-4 h-4" />,
    label: "Language",
    description: "UI translation",
  },
];

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-3.5 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
            {label}
          </p>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
        <span className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
          {displayValue ?? value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="[&_[role=slider]]:bg-purple-600 [&_[role=slider]]:border-purple-600 [&_.relative]:bg-purple-200 dark:[&_.relative]:bg-purple-900/40"
      />
    </div>
  );
}

export function CustomizationsPanel({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: CustomizationsPanelProps) {
  const [activeSection, setActiveSection] = useState<Section>("focus");

  const update = <K extends keyof AccessibilityEditorSettings>(
    key: K,
    value: AccessibilityEditorSettings[K]
  ) => {
    const next = { ...settings, [key]: value };
    onSettingsChange(next);
    saveSettings(next);
  };

  const t = (key: string) => getTranslation(key, settings.uiLanguage as Language);

  const reset = () => {
    onSettingsChange(defaultAccessibilitySettings);
    saveSettings(defaultAccessibilitySettings);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[420px] p-0 bg-white dark:bg-[#18181b] border-l border-gray-200 dark:border-white/10 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-white/5">
          <SheetTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            {t("settings.title")}
          </SheetTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t("settings.description")}
          </p>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Nav */}
          <nav className="w-[140px] flex-shrink-0 border-r border-gray-100 dark:border-white/5 px-2 py-3 flex flex-col gap-1 overflow-y-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg transition-all flex flex-col gap-0.5",
                  activeSection === s.id
                    ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200"
                )}
              >
                <span
                  className={cn(
                    "transition-colors",
                    activeSection === s.id
                      ? "text-purple-600 dark:text-purple-400"
                      : ""
                  )}
                >
                  {s.icon}
                </span>
                <span className="text-[11px] font-semibold leading-tight">
                  {t(`settings.${s.id}`)}
                </span>
                <span className="text-[10px] leading-tight opacity-70">
                  {t(`settings.${s.id}_desc`)}
                </span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* Focus & low energy */}
            {activeSection === "focus" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Focus & Low Energy Support
                </p>
                <SettingRow
                  label="Focus Mode"
                  description="Hide sidebar, terminal, and chat. Only the editor remains."
                >
                  <Switch
                    checked={settings.focusMode}
                    onCheckedChange={(v) => update("focusMode", v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Task Chunking"
                  description="Break tasks into smaller visual steps for easier focus."
                >
                  <Switch
                    checked={settings.showTaskChunking}
                    onCheckedChange={(v) => update("showTaskChunking", v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Time Estimates"
                  description="Show estimated time for completing code blocks."
                >
                  <Switch
                    checked={settings.showTimeEstimates}
                    onCheckedChange={(v) => update("showTimeEstimates", v)}
                  />
                </SettingRow>
              </div>
            )}

            {/* Reading comfort */}
            {activeSection === "reading" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Reading Comfort
                </p>
                <SettingRow
                  label="OpenDyslexic Font"
                  description="Readability font with weighted bottoms that reduce letter flipping."
                >
                  <Switch
                    checked={settings.useDyslexicFont}
                    onCheckedChange={(v) => update("useDyslexicFont", v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Increased Letter Spacing"
                  description="More space between characters for easier reading."
                >
                  <Switch
                    checked={settings.increasedLetterSpacing}
                    onCheckedChange={(v) => update("increasedLetterSpacing", v)}
                  />
                </SettingRow>
                <SliderRow
                  label="Line Height"
                  description="More space between lines reduces visual crowding."
                  value={settings.customLineHeight}
                  min={1.2}
                  max={2.5}
                  step={0.1}
                  displayValue={settings.customLineHeight.toFixed(1) + "×"}
                  onChange={(v) => update("customLineHeight", v)}
                />
                <SettingRow
                  label="Enhanced Syntax Colors"
                  description="High-contrast bracket pair colorization to separate code blocks."
                >
                  <Switch
                    checked={settings.enhancedSyntaxColors}
                    onCheckedChange={(v) => update("enhancedSyntaxColors", v)}
                  />
                </SettingRow>
              </div>
            )}

            {/* Visual Comfort */}
            {activeSection === "visual" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Visual Comfort
                </p>
                <SettingRow
                  label="Reduced Visual Noise"
                  description="Minimize UI decoration, whitespace indicators, and extra chrome."
                >
                  <Switch
                    checked={settings.reducedVisualNoise}
                    onCheckedChange={(v) => update("reducedVisualNoise", v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Minimalist UI"
                  description="Hide minimap, line numbers margin, and glyph decorations."
                >
                  <Switch
                    checked={settings.minimalistUI}
                    onCheckedChange={(v) => update("minimalistUI", v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Disable Autocomplete Popups"
                  description="Turn off suggestions and parameter hints (useful for anxiety/overwhelm)."
                >
                  <Switch
                    checked={settings.disablePopups}
                    onCheckedChange={(v) => update("disablePopups", v)}
                  />
                </SettingRow>
              </div>
            )}

            {/* Pomodoro */}
            {activeSection === "pomodoro" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Pomodoro Timer
                </p>
                <SettingRow
                  label="Enable Pomodoro Timer"
                  description="A visual timer in the corner with work/break cycles to maintain focus."
                >
                  <Switch
                    checked={settings.pomodoroEnabled}
                    onCheckedChange={(v) => update("pomodoroEnabled", v)}
                  />
                </SettingRow>
                {settings.pomodoroEnabled && (
                  <>
                    <SliderRow
                      label="Work Duration"
                      description="How long each focus session lasts."
                      value={settings.pomodoroWorkDuration}
                      min={5}
                      max={60}
                      step={5}
                      displayValue={settings.pomodoroWorkDuration + " min"}
                      onChange={(v) => update("pomodoroWorkDuration", v)}
                    />
                    <SliderRow
                      label="Break Duration"
                      description="How long each break lasts between sessions."
                      value={settings.pomodoroBreakDuration}
                      min={1}
                      max={30}
                      step={1}
                      displayValue={settings.pomodoroBreakDuration + " min"}
                      onChange={(v) => update("pomodoroBreakDuration", v)}
                    />
                  </>
                )}
              </div>
            )}

            {/* Panels / Layout */}
            {activeSection === "panels" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Layout & Panels
                </p>
                <div className="rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 p-3 mb-3">
                  <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                    💡 Tip: Press{" "}
                    <kbd className="bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded text-[10px] font-mono">
                      F11
                    </kbd>{" "}
                    anytime to instantly enter Focus Mode and hide all panels.
                    Press{" "}
                    <kbd className="bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded text-[10px] font-mono">
                      Alt+C
                    </kbd>{" "}
                    to toggle the AI chat panel.
                  </p>
                </div>
                <SettingRow
                  label="Focus Mode"
                  description="Show only the editor. Hide sidebar, terminal, and chat."
                >
                  <Switch
                    checked={settings.focusMode}
                    onCheckedChange={(v) => update("focusMode", v)}
                  />
                </SettingRow>
                <SettingRow
                  label="Minimalist Editor"
                  description="Hide minimap, line gutter decorations and margin chrome."
                >
                  <Switch
                    checked={settings.minimalistUI}
                    onCheckedChange={(v) => update("minimalistUI", v)}
                  />
                </SettingRow>
              </div>
            )}

            {/* Font Size */}
            {activeSection === "font" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  Font Size
                </p>
                <SliderRow
                  label="Editor Font Size"
                  description="Larger text is easier to read and reduces eye strain."
                  value={settings.fontSize}
                  min={11}
                  max={26}
                  step={1}
                  displayValue={settings.fontSize + "px"}
                  onChange={(v) => update("fontSize", v)}
                />

                {/* Live Preview */}
                <div className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-[#1e1e1e] p-4 overflow-hidden">
                  <p className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wider">
                    Preview
                  </p>
                  <pre
                    style={{
                      fontSize: settings.fontSize,
                      lineHeight: settings.customLineHeight,
                      letterSpacing: settings.increasedLetterSpacing
                        ? "0.05em"
                        : "normal",
                      fontFamily: settings.useDyslexicFont
                        ? "'Comic Sans MS', monospace"
                        : "'Consolas', 'Courier New', monospace",
                    }}
                    className="text-green-400 overflow-x-auto"
                  >
                    {`def hello():\n    print("Hello, World!")\n\nhello()`}
                  </pre>
                </div>
              </div>
            )}

            {/* Language Selection */}
            {activeSection === "language" && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  UI Language
                </p>
                <div className="space-y-2">
                  {[
                    { val: "en", label: "English" },
                    { val: "id", label: "Bahasa Indonesia" },
                    { val: "es", label: "Español" },
                    { val: "ja", label: "日本語 (Japanese)" },
                    { val: "fr", label: "Français (French)" },
                    { val: "de", label: "Deutsch (German)" },
                    { val: "zh", label: "中文 (Chinese)" },
                    { val: "ko", label: "한국어 (Korean)" },
                    { val: "ar", label: "العربية (Arabic)" },
                    { val: "ru", label: "Русский (Russian)" },
                    { val: "pt", label: "Português (Portuguese)" },
                    { val: "it", label: "Italiano (Italian)" }
                  ].map((lang) => (
                    <button
                      key={lang.val}
                      onClick={() => update("uiLanguage", lang.val as any)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded border transition-colors",
                        settings.uiLanguage === lang.val
                          ? "bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-medium"
                          : "bg-white border-transparent hover:border-gray-200 dark:bg-[#1a1a1a] dark:text-gray-300 dark:hover:border-gray-700"
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("settings.reset")}
          </Button>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4"
          >
            {t("settings.done")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

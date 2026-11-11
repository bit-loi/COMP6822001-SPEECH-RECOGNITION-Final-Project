"use client";

import { useEffect, useState } from "react";

interface FocusModeProps {
  enabled: boolean;
  currentLine: number;
  totalLines: number;
}

export function FocusMode({ enabled, currentLine, totalLines }: FocusModeProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (enabled) {
      setOpacity(0.7);
    } else {
      setOpacity(0);
    }
  }, [enabled]);

  if (!enabled) return null;

  // Calculate the position of the current line
  const lineHeight = 100 / totalLines;
  const currentPosition = currentLine * lineHeight;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Top overlay - dims everything above current line */}
      <div
        className="absolute left-0 right-0 top-0 bg-background transition-all duration-300"
        style={{
          height: `${currentPosition}%`,
          opacity: opacity,
        }}
      />

      {/* Current line highlight - no overlay */}
      <div
        className="absolute left-0 right-0 border-l-4 border-primary"
        style={{
          top: `${currentPosition}%`,
          height: `${lineHeight}%`,
          opacity: 1,
        }}
      />

      {/* Bottom overlay - dims everything below current line */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-background transition-all duration-300"
        style={{
          height: `${100 - currentPosition - lineHeight}%`,
          opacity: opacity,
        }}
      />
    </div>
  );
}

interface PomodoroTimerProps {
  enabled: boolean;
  workDuration: number; // minutes
  breakDuration: number; // minutes
  onBreakTime?: () => void;
}

export function PomodoroTimer({
  enabled,
  workDuration,
  breakDuration,
  onBreakTime,
}: PomodoroTimerProps) {
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isWorking, setIsWorking] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!enabled || !isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer finished
          if (isWorking) {
            // Work session ended, start break
            setIsWorking(false);
            onBreakTime?.();
            return breakDuration * 60;
          } else {
            // Break ended, start work
            setIsWorking(true);
            return workDuration * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, isRunning, isWorking, workDuration, breakDuration, onBreakTime]);

  if (!enabled) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = isWorking
    ? ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100
    : ((breakDuration * 60 - timeLeft) / (breakDuration * 60)) * 100;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-card p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16">
          {/* Progress circle */}
          <svg className="h-16 w-16 -rotate-90 transform">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-muted"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              className={isWorking ? "text-primary" : "text-accessible-success"}
              strokeLinecap="round"
            />
          </svg>
          {/* Time display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {isWorking ? "Focus Time" : "Break Time"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
            >
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              onClick={() => {
                setIsWorking(true);
                setTimeLeft(workDuration * 60);
                setIsRunning(false);
              }}
              className="rounded bg-secondary px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary/90"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

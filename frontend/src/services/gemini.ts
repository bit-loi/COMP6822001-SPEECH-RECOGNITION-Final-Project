import type { AIContext, AIResponse, Task } from "@/types";

const BACKEND_URL = 'http://localhost:3001/api/ai';

class GeminiService {
  async detectEmotionalState(context: {
    recentActions: string[];
    timeSpent: number;
    errorCount: number;
    deletionCount: number;
  }): Promise<{
    state: "flow" | "focused" | "frustrated" | "confused" | "tired" | "neutral";
    confidence: number;
    reasoning: string;
  }> {
    try {
      const res = await fetch(`${BACKEND_URL}/emotional-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context)
      });
      if (!res.ok) throw new Error('Backend error');
      return res.json();
    } catch (e) {
      console.error(e);
      return { state: "neutral", confidence: 0, reasoning: "Backend unavailable" };
    }
  }

  async breakdownTask(taskDescription: string): Promise<Task> {
      const res = await fetch(`${BACKEND_URL}/task-breakdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskDescription })
      });
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      
      return {
          id: `task-${Date.now()}`,
          ...data,
          subtasks: data.subtasks.map((st: any, idx: number) => ({
              id: `subtask-${Date.now()}-${idx}`,
              completed: false,
              ...st
          })),
          status: "todo",
          actualTime: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
      };
  }

  async explainCode(code: string, context?: string): Promise<AIResponse> {
      const res = await fetch(`${BACKEND_URL}/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, context })
      });
      return res.json();
  }

  async getSuggestions(context: AIContext): Promise<AIResponse> {
      const res = await fetch(`${BACKEND_URL}/suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context)
      });
      return res.json();
  }

  async helpWithError(errorMessage: string, code: string, context?: string): Promise<AIResponse> {
      const res = await fetch(`${BACKEND_URL}/debug`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorMessage, code, context })
      });
      return res.json();
  }
}

export const geminiService = new GeminiService();

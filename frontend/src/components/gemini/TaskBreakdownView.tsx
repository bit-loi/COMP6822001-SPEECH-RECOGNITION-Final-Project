'use client';

import { TaskBreakdown, Subtask } from '@/lib/gemini';
import { 
  ListTodo, 
  Clock, 
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Zap,
  Target
} from 'lucide-react';
import { useState } from 'react';

interface TaskBreakdownViewProps {
  breakdown: TaskBreakdown;
  className?: string;
  onTaskComplete?: (taskId: string) => void;
}

/**
 * Visual task breakdown with dependency tracking
 */
export function TaskBreakdownView({ 
  breakdown, 
  className = '',
  onTaskComplete 
}: TaskBreakdownViewProps) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const handleTaskToggle = (taskId: string) => {
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(taskId)) {
      newCompleted.delete(taskId);
    } else {
      newCompleted.add(taskId);
      onTaskComplete?.(taskId);
    }
    setCompletedTasks(newCompleted);
  };

  const handleExpandToggle = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const getComplexityConfig = (complexity: string) => {
    switch (complexity) {
      case 'low':
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          icon: Zap,
          label: 'Easy',
        };
      case 'high':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          icon: AlertCircle,
          label: 'Complex',
        };
      default:
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          icon: Target,
          label: 'Medium',
        };
    }
  };

  const isTaskAvailable = (task: Subtask): boolean => {
    return task.dependencies.every(depId => completedTasks.has(depId));
  };

  const completedCount = completedTasks.size;
  const totalCount = breakdown.subtasks.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  const completedTime = breakdown.subtasks
    .filter(task => completedTasks.has(task.id))
    .reduce((sum, task) => sum + task.estimatedMinutes, 0);

  const remainingTime = breakdown.totalEstimate - completedTime;

  return (
    <div className={`bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-lg">
            <ListTodo className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Task Breakdown</h3>
            <p className="text-xs text-gray-400 mt-1">
              {completedCount} of {totalCount} completed
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-purple-400">
            {Math.round(progressPercentage)}%
          </div>
          <div className="text-xs text-gray-400 flex items-center justify-end mt-1">
            <Clock className="w-3 h-3 mr-1" />
            {remainingTime} min left
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {breakdown.subtasks.map((task, index) => {
          const isCompleted = completedTasks.has(task.id);
          const isAvailable = isTaskAvailable(task);
          const isExpanded = expandedTasks.has(task.id);
          const complexityConfig = getComplexityConfig(task.complexity);
          const ComplexityIcon = complexityConfig.icon;

          return (
            <div
              key={task.id}
              className={`border rounded-lg transition-all ${
                isCompleted
                  ? 'bg-green-500/10 border-green-500/30'
                  : isAvailable
                  ? 'bg-gray-800/50 border-gray-700 hover:border-purple-500/30'
                  : 'bg-gray-900/50 border-gray-800 opacity-50'
              }`}
            >
              <div className="p-3">
                <div className="flex items-start space-x-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => isAvailable && handleTaskToggle(task.id)}
                    disabled={!isAvailable}
                    className="mt-0.5"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Circle className={`w-5 h-5 ${isAvailable ? 'text-gray-500 hover:text-purple-400' : 'text-gray-700'}`} />
                    )}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                          <p className={`text-sm font-medium ${
                            isCompleted ? 'text-gray-400 line-through' : 'text-gray-200'
                          }`}>
                            {task.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-3 mt-2">
                          {/* Time Estimate */}
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{task.estimatedMinutes} min</span>
                          </div>

                          {/* Complexity Badge */}
                          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs ${complexityConfig.bgColor} ${complexityConfig.color}`}>
                            <ComplexityIcon className="w-3 h-3" />
                            <span>{complexityConfig.label}</span>
                          </div>

                          {/* Dependencies Indicator */}
                          {task.dependencies.length > 0 && (
                            <button
                              onClick={() => handleExpandToggle(task.id)}
                              className="flex items-center space-x-1 text-xs text-gray-500 hover:text-purple-400"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                              <span>{task.dependencies.length} deps</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dependencies (Expanded) */}
                    {isExpanded && task.dependencies.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-400 mb-2">Depends on:</p>
                        <div className="space-y-1">
                          {task.dependencies.map(depId => {
                            const depTask = breakdown.subtasks.find(t => t.id === depId);
                            const isDepCompleted = completedTasks.has(depId);
                            return depTask ? (
                              <div
                                key={depId}
                                className="flex items-center space-x-2 text-xs"
                              >
                                {isDepCompleted ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Circle className="w-3 h-3 text-gray-600" />
                                )}
                                <span className={isDepCompleted ? 'text-gray-500 line-through' : 'text-gray-400'}>
                                  {depTask.description}
                                </span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Blocked Message */}
                    {!isAvailable && !isCompleted && (
                      <div className="mt-2 text-xs text-orange-400 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Complete dependencies first</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-5 pt-5 border-t border-gray-800">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-400">{completedCount}</div>
            <div className="text-xs text-gray-400 mt-1">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">{totalCount - completedCount}</div>
            <div className="text-xs text-gray-400 mt-1">Remaining</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">{remainingTime}</div>
            <div className="text-xs text-gray-400 mt-1">Minutes Left</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for task breakdown
 */
export function TaskBreakdownLoading() {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gray-700 rounded-lg" />
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-700 rounded w-24" />
        </div>
      </div>
      <div className="h-3 bg-gray-700 rounded-full mb-5" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

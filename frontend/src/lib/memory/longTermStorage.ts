import { compress, decompress } from 'lz-string';
import { LongTermMemory, ProjectStructure, CommonPattern, EmotionalPattern, CodingStyle } from './types';

const STORAGE_KEY = 'ambatucode-longterm-memory';
const VERSION = '1.0.0';

/**
 * LocalStorage wrapper for long-term memory with compression
 */
export class LongTermStorage {
  /**
   * Save long-term memory with compression
   */
  save(memory: LongTermMemory): void {
    try {
      const data = JSON.stringify({
        version: VERSION,
        data: memory,
        savedAt: new Date().toISOString(),
      });

      const compressed = compress(data);
      localStorage.setItem(STORAGE_KEY, compressed);
    } catch (error) {
      console.error('Failed to save long-term memory:', error);
      throw new Error('Failed to save long-term memory');
    }
  }

  /**
   * Load long-term memory with decompression
   */
  load(): LongTermMemory | null {
    try {
      const compressed = localStorage.getItem(STORAGE_KEY);
      if (!compressed) return null;

      const decompressed = decompress(compressed);
      if (!decompressed) return null;

      const parsed = JSON.parse(decompressed);
      
      // Version check
      if (parsed.version !== VERSION) {
        console.warn('Memory version mismatch, migrating...');
        return this.migrate(parsed);
      }

      // Convert date strings back to Date objects
      return this.deserialize(parsed.data);
    } catch (error) {
      console.error('Failed to load long-term memory:', error);
      return null;
    }
  }

  /**
   * Update project structure
   */
  updateProjectStructure(structure: ProjectStructure): void {
    const memory = this.load() || this.getDefault();
    memory.projectStructure = structure;
    memory.lastUpdated = new Date();
    this.save(memory);
  }

  /**
   * Add or update common pattern
   */
  addPattern(pattern: CommonPattern): void {
    const memory = this.load() || this.getDefault();
    
    const existingIndex = memory.commonPatterns.findIndex(p => p.id === pattern.id);
    if (existingIndex >= 0) {
      memory.commonPatterns[existingIndex] = pattern;
    } else {
      memory.commonPatterns.push(pattern);
    }

    // Keep only top 50 patterns by usage
    memory.commonPatterns.sort((a, b) => b.usageCount - a.usageCount);
    memory.commonPatterns = memory.commonPatterns.slice(0, 50);

    memory.lastUpdated = new Date();
    this.save(memory);
  }

  /**
   * Update coding style
   */
  updateCodingStyle(style: Partial<CodingStyle>): void {
    const memory = this.load() || this.getDefault();
    memory.codingStyle = { ...memory.codingStyle, ...style };
    memory.lastUpdated = new Date();
    this.save(memory);
  }

  /**
   * Add emotional pattern
   */
  addEmotionalPattern(pattern: EmotionalPattern): void {
    const memory = this.load() || this.getDefault();
    memory.emotionalPatterns.push(pattern);

    // Keep only last 100 emotional patterns
    if (memory.emotionalPatterns.length > 100) {
      memory.emotionalPatterns = memory.emotionalPatterns.slice(-100);
    }

    memory.lastUpdated = new Date();
    this.save(memory);
  }

  /**
   * Update session statistics
   */
  updateSessionStats(stats: {
    sessionTime: number;
    breaksTaken: number;
    focusTime: number;
    workingHour: number;
  }): void {
    const memory = this.load() || this.getDefault();
    
    memory.totalSessionTime += stats.sessionTime;
    memory.totalBreaksTaken += stats.breaksTaken;
    
    // Update average focus time (exponential moving average)
    const alpha = 0.3;
    memory.averageFocusTime = 
      memory.averageFocusTime * (1 - alpha) + stats.focusTime * alpha;

    // Update preferred working hours
    if (!memory.preferredWorkingHours.includes(stats.workingHour)) {
      memory.preferredWorkingHours.push(stats.workingHour);
      memory.preferredWorkingHours.sort((a, b) => a - b);
    }

    memory.lastUpdated = new Date();
    this.save(memory);
  }

  /**
   * Get storage size in bytes
   */
  getStorageSize(): number {
    const compressed = localStorage.getItem(STORAGE_KEY);
    if (!compressed) return 0;
    return new Blob([compressed]).size;
  }

  /**
   * Clear all long-term memory
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Export memory for backup
   */
  export(): string {
    const memory = this.load();
    if (!memory) return '';

    return JSON.stringify({
      version: VERSION,
      exportDate: new Date().toISOString(),
      data: memory,
    }, null, 2);
  }

  /**
   * Import memory from backup
   */
  import(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!parsed.data) {
        throw new Error('Invalid import format');
      }

      const memory = this.deserialize(parsed.data);
      this.save(memory);
      return true;
    } catch (error) {
      console.error('Failed to import memory:', error);
      return false;
    }
  }

  /**
   * Get default long-term memory
   */
  private getDefault(): LongTermMemory {
    return {
      projectStructure: null,
      commonPatterns: [],
      codingStyle: {
        indentation: 'spaces',
        indentSize: 2,
        quotes: 'single',
        semicolons: true,
        trailingComma: true,
        bracketSpacing: true,
        arrowParens: 'always',
      },
      emotionalPatterns: [],
      totalSessionTime: 0,
      totalBreaksTaken: 0,
      averageFocusTime: 25, // default 25 minutes
      preferredWorkingHours: [],
      lastUpdated: new Date(),
    };
  }

  /**
   * Deserialize dates from JSON
   */
  private deserialize(data: any): LongTermMemory {
    return {
      ...data,
      projectStructure: data.projectStructure ? {
        ...data.projectStructure,
        lastAnalyzed: new Date(data.projectStructure.lastAnalyzed),
        fileTree: Object.entries(data.projectStructure.fileTree || {}).reduce((acc, [path, info]: [string, any]) => {
          acc[path] = {
            ...info,
            lastModified: new Date(info.lastModified),
          };
          return acc;
        }, {} as any),
      } : null,
      commonPatterns: (data.commonPatterns || []).map((p: any) => ({
        ...p,
        lastUsed: new Date(p.lastUsed),
      })),
      emotionalPatterns: (data.emotionalPatterns || []).map((p: any) => ({
        ...p,
        date: new Date(p.date),
      })),
      lastUpdated: new Date(data.lastUpdated),
    };
  }

  /**
   * Migrate from old version
   */
  private migrate(oldData: any): LongTermMemory {
    // For now, just return default and log warning
    console.warn('Migration not implemented, using defaults');
    return this.getDefault();
  }
}

// Singleton instance
let longTermStorageInstance: LongTermStorage | null = null;

/**
 * Get long-term storage instance
 */
export function getLongTermStorage(): LongTermStorage {
  if (!longTermStorageInstance) {
    longTermStorageInstance = new LongTermStorage();
  }
  return longTermStorageInstance;
}

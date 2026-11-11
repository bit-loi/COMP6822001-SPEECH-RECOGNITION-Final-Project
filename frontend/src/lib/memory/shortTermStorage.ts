import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ShortTermMemory, FileEditHistory, ProblemSolved, LearnedPattern } from './types';

/**
 * IndexedDB schema for short-term memory
 */
interface MemoryDB extends DBSchema {
  files: {
    key: string;
    value: FileEditHistory;
    indexes: { 'by-date': Date };
  };
  problems: {
    key: string;
    value: ProblemSolved;
    indexes: { 'by-date': Date };
  };
  patterns: {
    key: string;
    value: LearnedPattern;
    indexes: { 'by-frequency': number; 'by-date': Date };
  };
}

const DB_NAME = 'neuravity-memory';
const DB_VERSION = 1;

/**
 * IndexedDB wrapper for short-term memory storage
 */
export class ShortTermStorage {
  private db: IDBPDatabase<MemoryDB> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      this.db = await openDB<MemoryDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Files store
          if (!db.objectStoreNames.contains('files')) {
            const filesStore = db.createObjectStore('files', { keyPath: 'filePath' });
            filesStore.createIndex('by-date', 'lastEdited');
          }

          // Problems store
          if (!db.objectStoreNames.contains('problems')) {
            const problemsStore = db.createObjectStore('problems', { keyPath: 'id' });
            problemsStore.createIndex('by-date', 'timestamp');
          }

          // Patterns store
          if (!db.objectStoreNames.contains('patterns')) {
            const patternsStore = db.createObjectStore('patterns', { keyPath: 'id' });
            patternsStore.createIndex('by-frequency', 'frequency');
            patternsStore.createIndex('by-date', 'lastUsed');
          }
        },
      });
    })();

    await this.initPromise;
  }

  /**
   * Save file edit history
   */
  async saveFileHistory(file: FileEditHistory): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.put('files', file);
  }

  /**
   * Get file edit history
   */
  async getFileHistory(filePath: string): Promise<FileEditHistory | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const file = await this.db.get('files', filePath);
    return file || null;
  }

  /**
   * Get all files edited in last N hours
   */
  async getRecentFiles(hours: number = 24): Promise<FileEditHistory[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const allFiles = await this.db.getAllFromIndex('files', 'by-date');
    
    return allFiles.filter(file => file.lastEdited >= cutoffTime);
  }

  /**
   * Save problem solved
   */
  async saveProblem(problem: ProblemSolved): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.put('problems', problem);
  }

  /**
   * Get recent problems solved
   */
  async getRecentProblems(hours: number = 24): Promise<ProblemSolved[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const allProblems = await this.db.getAllFromIndex('problems', 'by-date');
    
    return allProblems.filter(problem => problem.timestamp >= cutoffTime);
  }

  /**
   * Save learned pattern
   */
  async savePattern(pattern: LearnedPattern): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.put('patterns', pattern);
  }

  /**
   * Get pattern by ID
   */
  async getPattern(id: string): Promise<LearnedPattern | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const pattern = await this.db.get('patterns', id);
    return pattern || null;
  }

  /**
   * Get most frequent patterns
   */
  async getTopPatterns(limit: number = 10): Promise<LearnedPattern[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const allPatterns = await this.db.getAllFromIndex('patterns', 'by-frequency');
    return allPatterns.reverse().slice(0, limit);
  }

  /**
   * Get all short-term memory
   */
  async getAll(): Promise<ShortTermMemory> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const [filesEdited, problemsSolved, patternsLearned] = await Promise.all([
      this.getRecentFiles(24),
      this.getRecentProblems(24),
      this.db.getAll('patterns'),
    ]);

    return {
      filesEdited,
      problemsSolved,
      patternsLearned,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clean up old data (older than N days)
   */
  async cleanup(days: number = 7): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Clean old files
    const allFiles = await this.db.getAllFromIndex('files', 'by-date');
    const oldFiles = allFiles.filter(file => file.lastEdited < cutoffTime);
    await Promise.all(oldFiles.map(file => this.db!.delete('files', file.filePath)));

    // Clean old problems
    const allProblems = await this.db.getAllFromIndex('problems', 'by-date');
    const oldProblems = allProblems.filter(problem => problem.timestamp < cutoffTime);
    await Promise.all(oldProblems.map(problem => this.db!.delete('problems', problem.id)));

    // Clean old patterns (keep top 100 by frequency)
    const allPatterns = await this.db.getAllFromIndex('patterns', 'by-frequency');
    if (allPatterns.length > 100) {
      const toDelete = allPatterns.slice(0, allPatterns.length - 100);
      await Promise.all(toDelete.map(pattern => this.db!.delete('patterns', pattern.id)));
    }
  }

  /**
   * Get storage size estimate
   */
  async getStorageSize(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const [files, problems, patterns] = await Promise.all([
      this.db.getAll('files'),
      this.db.getAll('problems'),
      this.db.getAll('patterns'),
    ]);

    // Rough estimate: JSON stringify and get byte length
    const totalData = JSON.stringify({ files, problems, patterns });
    return new Blob([totalData]).size;
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    await Promise.all([
      this.db.clear('files'),
      this.db.clear('problems'),
      this.db.clear('patterns'),
    ]);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Singleton instance
let shortTermStorageInstance: ShortTermStorage | null = null;

/**
 * Get short-term storage instance
 */
export function getShortTermStorage(): ShortTermStorage {
  if (!shortTermStorageInstance) {
    shortTermStorageInstance = new ShortTermStorage();
  }
  return shortTermStorageInstance;
}

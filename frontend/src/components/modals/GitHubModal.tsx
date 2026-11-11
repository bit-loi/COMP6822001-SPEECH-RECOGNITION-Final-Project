import React, { useState, useEffect } from 'react';
import { X, Github, Loader2 } from 'lucide-react';
import { FileNode, GitHubRepo } from '@/types/editor';
import { fetchUserRepos, importRepository } from '@/services/github';
import { memoryService } from '@/services/memory';

interface GitHubModalProps {
  show: boolean;
  onClose: () => void;
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  show,
  onClose,
  fileTree,
  setFileTree,
}) => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  useEffect(() => {
    if (show) {
      loadRepos();
    }
  }, [show]);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const userRepos = await fetchUserRepos();
      setRepos(userRepos);
    } catch (error) {
      console.error('Failed to load repos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (repo: GitHubRepo) => {
    setImporting(true);
    setSelectedRepo(repo);

    try {
      const importedTree = await importRepository(repo);
      const updatedTree = [...fileTree, ...importedTree];
      setFileTree(updatedTree);
      await memoryService.saveFileTree(updatedTree);
      onClose();
    } catch (error) {
      console.error('Failed to import repository:', error);
    } finally {
      setImporting(false);
      setSelectedRepo(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#252526] rounded-lg p-6 w-[600px] max-h-[80vh] shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Github className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Import from GitHub</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {repos.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No repositories found</p>
            ) : (
              repos.map(repo => (
                <div
                  key={repo.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{repo.name}</h3>
                      {repo.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        {repo.language && (
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span>{repo.language}</span>
                          </span>
                        )}
                        <span>⭐ {repo.stargazers_count}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(repo)}
                      disabled={importing}
                      className="ml-4 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-gray-400 text-white rounded flex items-center space-x-1"
                    >
                      {importing && selectedRepo?.id === repo.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : (
                        <span>Import</span>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

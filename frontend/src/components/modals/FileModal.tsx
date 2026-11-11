import React from 'react';
import { X } from 'lucide-react';

interface FileModalProps {
  show: boolean;
  onClose: () => void;
  onCreate: () => void;
  newItemName: string;
  setNewItemName: (name: string) => void;
}

export const FileModal: React.FC<FileModalProps> = ({
  show,
  onClose,
  onCreate,
  newItemName,
  setNewItemName,
}) => {
  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#252526] rounded-lg p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create New File</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="File name (e.g., main.py)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1e1e1e] text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoFocus
          />

          <div className="flex justify-end space-x-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

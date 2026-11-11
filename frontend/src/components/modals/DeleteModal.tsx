import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  show,
  onClose,
  onConfirm,
  itemName,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#252526] rounded-lg p-6 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">Delete Confirmation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <span className="font-semibold text-black dark:text-white">{itemName}</span>? This action cannot be undone.
        </p>

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

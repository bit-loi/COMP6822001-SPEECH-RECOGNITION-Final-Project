import React from 'react';
import { FileNode } from '@/types/editor';
import { memoryService } from '@/services/memory';

interface FileOperationsProps {
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;
  showFileModal: boolean;
  setShowFileModal: (show: boolean) => void;
  showFolderModal: boolean;
  setShowFolderModal: (show: boolean) => void;
  showDeleteModal: boolean;
  setShowDeleteModal: (show: boolean) => void;
  modalParentPath: string;
  setModalParentPath: (path: string) => void;
  newItemName: string;
  setNewItemName: (name: string) => void;
  itemToDelete: FileNode | null;
  setItemToDelete: (item: FileNode | null) => void;
  setCurrentFilePath: (path: string) => void;
  setCode: (code: string) => void;
  setOpenFiles: React.Dispatch<React.SetStateAction<string[]>>;
}

export const useFileOperations = ({
  fileTree,
  setFileTree,
  setShowFileModal,
  setShowFolderModal,
  setShowDeleteModal,
  modalParentPath,
  newItemName,
  setNewItemName,
  setModalParentPath,
  itemToDelete,
  setItemToDelete,
  setCurrentFilePath,
  setCode,
  setOpenFiles,
}: FileOperationsProps) => {
  const handleOpenFileModal = (path: string) => {
    setModalParentPath(path);
    setShowFileModal(true);
  };

  const handleOpenFolderModal = (path: string) => {
    setModalParentPath(path);
    setShowFolderModal(true);
  };

  const handleCreateFile = async () => {
    if (!newItemName.trim()) return;

    const newPath = modalParentPath ? `${modalParentPath}/${newItemName}` : newItemName;
    const newFile: FileNode = {
      name: newItemName,
      path: newPath,
      type: 'file',
      content: '',
    };

    const addFileToTree = (nodes: FileNode[], parentPath: string): FileNode[] => {
      if (parentPath === '') {
        return [...nodes, newFile];
      }

      return nodes.map(node => {
        if (node.path === parentPath && node.type === 'folder') {
          return {
            ...node,
            children: [...(node.children || []), newFile],
          };
        }
        if (node.children) {
          return {
            ...node,
            children: addFileToTree(node.children, parentPath),
          };
        }
        return node;
      });
    };

    const updatedTree = addFileToTree(fileTree, modalParentPath);
    setFileTree(updatedTree);
    await memoryService.saveFileTree(updatedTree);

    setNewItemName('');
    setShowFileModal(false);
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;

    const newPath = modalParentPath ? `${modalParentPath}/${newItemName}` : newItemName;
    const newFolder: FileNode = {
      name: newItemName,
      path: newPath,
      type: 'folder',
      children: [],
    };

    const addFolderToTree = (nodes: FileNode[], parentPath: string): FileNode[] => {
      if (parentPath === '') {
        return [...nodes, newFolder];
      }

      return nodes.map(node => {
        if (node.path === parentPath && node.type === 'folder') {
          return {
            ...node,
            children: [...(node.children || []), newFolder],
          };
        }
        if (node.children) {
          return {
            ...node,
            children: addFolderToTree(node.children, parentPath),
          };
        }
        return node;
      });
    };

    const updatedTree = addFolderToTree(fileTree, modalParentPath);
    setFileTree(updatedTree);
    await memoryService.saveFileTree(updatedTree);

    setNewItemName('');
    setShowFolderModal(false);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    const deleteFromTree = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .filter(node => node.path !== itemToDelete.path)
        .map(node => ({
          ...node,
          children: node.children ? deleteFromTree(node.children) : undefined,
        }));
    };

    const updatedTree = deleteFromTree(fileTree);
    setFileTree(updatedTree);
    await memoryService.saveFileTree(updatedTree);

    if (itemToDelete.type === 'file') {
      setOpenFiles(prev => prev.filter(path => path !== itemToDelete.path));
    }

    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const handleDelete = (node: FileNode) => {
    setItemToDelete(node);
    setShowDeleteModal(true);
  };

  return {
    handleOpenFileModal,
    handleOpenFolderModal,
    handleCreateFile,
    handleCreateFolder,
    handleDelete,
    handleDeleteConfirm,
  };
};

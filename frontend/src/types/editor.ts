
export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface TerminalTab {
  id: string;
  name: string;
}

export const getLanguageFromFilename = (filename: string) => {
  if (!filename) return 'typescript';
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    c: 'cpp', cpp: 'cpp', h: 'cpp', hpp: 'cpp',
    java: 'java',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    yaml: 'yaml', yml: 'yaml',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    dockerfile: 'dockerfile',
    xml: 'xml',
    php: 'php',
    rb: 'ruby',
    lua: 'lua',
    r: 'r',
    swift: 'swift',
    kt: 'kotlin', kts: 'kotlin',
    dart: 'dart',
  };
  return map[ext || ''] || 'plaintext';
};

export const findNodeContent = (nodes: FileNode[], targetPath: string): string | null => {
  for (const node of nodes) {
    if (node.path === targetPath && node.type === 'file') return node.content || '';
    if (node.children) {
      const res = findNodeContent(node.children, targetPath);
      if (res !== null) return res;
    }
  }
  return null;
};

export const getProjectContext = (nodes: FileNode[]): string => {
  let context = 'Project Files:\n\n';
  const traverse = (node: FileNode) => {
    if (node.type === 'file') {
      context += `File: ${node.path}\nContent:\n${node.content || ''}\n\n`;
    } else if (node.children) {
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return context;
};

export const findNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const res = findNode(node.children, targetPath);
      if (res) return res;
    }
  }
  return null;
};

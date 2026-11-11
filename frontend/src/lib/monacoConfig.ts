/**
 * Monaco Editor Configuration
 * Provides syntax highlighting and basic error detection for multiple languages
 */

/**
 * Configure Monaco Editor when it mounts
 * This should be called in the onMount callback of the Editor component
 */
export const configureMonacoEditor = (monaco: any) => {
  // TypeScript/JavaScript configuration
  if (monaco.languages.typescript) {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
    });

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      allowJs: true,
    });
  }

  // Configure editor options for better error display
  monaco.editor.defineTheme('ambatucode-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955' },
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#D4D4D4',
      'editor.lineHighlightBackground': '#2A2A2A',
      'editorCursor.foreground': '#AEAFAD',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41',
    },
  });

  monaco.editor.defineTheme('ambatucode-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267F99' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F0F0F0',
      'editorCursor.foreground': '#000000',
      'editor.selectionBackground': '#ADD6FF',
      'editor.inactiveSelectionBackground': '#E5EBF1',
    },
  });
};

/**
 * Get Monaco language ID from file extension
 */
export const getMonacoLanguage = (filename: string): string => {
  if (!filename) return 'plaintext';
  
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    
    // Python
    'py': 'python',
    'pyw': 'python',
    
    // Java
    'java': 'java',
    
    // C/C++
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'hxx': 'cpp',
    
    // Go
    'go': 'go',
    
    // Rust
    'rs': 'rust',
    
    // PHP
    'php': 'php',
    'phtml': 'php',
    
    // Ruby
    'rb': 'ruby',
    'erb': 'ruby',
    
    // C#
    'cs': 'csharp',
    
    // Swift
    'swift': 'swift',
    
    // Kotlin
    'kt': 'kotlin',
    'kts': 'kotlin',
    
    // Dart
    'dart': 'dart',
    
    // Lua
    'lua': 'lua',
    
    // R
    'r': 'r',
    
    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    
    // SQL
    'sql': 'sql',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    
    // Data
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'conf': 'ini',
    
    // Markdown
    'md': 'markdown',
    'markdown': 'markdown',
    
    // Other
    'txt': 'plaintext',
    'log': 'plaintext',
  };

  return languageMap[ext || ''] || 'plaintext';
};

/**
 * Get editor options with error highlighting enabled
 */
export const getEditorOptions = (readOnly: boolean = false) => ({
  minimap: { enabled: true },
  fontSize: 14,
  lineNumbers: 'on' as const,
  roundedSelection: false,
  scrollBeyondLastLine: false,
  readOnly,
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on' as const,
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on' as const,
  snippetSuggestions: 'top' as const,
  formatOnPaste: true,
  formatOnType: true,
  // Error highlighting
  glyphMargin: true,
  folding: true,
  foldingHighlight: true,
  showFoldingControls: 'always' as const,
  // Diagnostics
  'semanticHighlighting.enabled': true,
});

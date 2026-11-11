
interface PistonResponse {
  run: {
    stdout: string;
    stderr: string;
    output: string;
    code: number;
    signal: string | null;
  };
  language: string;
  version: string;
}

const LANGUAGE_MAP: { [key: string]: string } = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
};

const VERSION_MAP: { [key: string]: string } = {
  javascript: '18.15.0',
  typescript: '5.0.3',
  python: '3.10.0',
  go: '1.19.0',
  rust: '1.68.2',
  c: '10.2.0',
  cpp: '10.2.0',
  java: '15.0.2',
};

export const executeCode = async (languageExt: string, sourceCode: string): Promise<string> => {
  const language = LANGUAGE_MAP[languageExt] || languageExt;
  const version = VERSION_MAP[language] || '*';

  if (!language) {
    return `Error: Unsupported language extension .${languageExt}`;
  }

  try {
    const response = await fetch('http://localhost:3002/api/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        code: sourceCode,
      }),
    });

    const data = await response.json();

    if (data.error) {
       return `Error: ${data.error}`;
    }
    
    // Piston output format from backend
    if (data.run) {
        return data.run.output;
    }
    
    return JSON.stringify(data);
  } catch (error) {
    console.error('Execution Error:', error);
    return 'Error: Failed to connect to Backend Compiler Service (Ensure backend is running on port 3001).';
  }
};

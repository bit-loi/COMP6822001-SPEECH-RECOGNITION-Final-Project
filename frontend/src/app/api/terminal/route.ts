import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

// Store active terminal sessions
const sessions = new Map<string, any>();

export async function POST(request: NextRequest) {
  const { sessionId, command } = await request.json();

  if (!sessionId) {
    return Response.json({ error: 'Session ID required' }, { status: 400 });
  }

  // Create new session if doesn't exist
  if (!sessions.has(sessionId)) {
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
    const terminal = spawn(shell, [], {
      cwd: process.cwd(),
      env: process.env,
    });

    const session = {
      terminal,
      output: [] as string[],
    };

    terminal.stdout.on('data', (data) => {
      session.output.push(data.toString());
    });

    terminal.stderr.on('data', (data) => {
      session.output.push(data.toString());
    });

    sessions.set(sessionId, session);
  }

  const session = sessions.get(sessionId);

  if (command) {
    // Execute command
    session.terminal.stdin.write(command + '\n');
    
    // Wait a bit for output
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Get output
  const output = session.output.splice(0);

  return Response.json({ output });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.terminal.kill();
    sessions.delete(sessionId);
  }

  return Response.json({ success: true });
}

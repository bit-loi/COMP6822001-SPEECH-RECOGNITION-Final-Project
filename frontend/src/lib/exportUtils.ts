/**
 * Neuravity Export Utilities
 * - exportChatHistory: Chat session → Markdown file (for therapists, notes, Obsidian)
 * - exportProjectZip: All editor files → ZIP download
 */

import { Message } from '@/types/editor';
import { FileNode } from '@/types/editor';

// ─────────────────────────────────────────────
// Chat History → Markdown
// ─────────────────────────────────────────────

function formatTimestamp(ts: Date | string): string {
  const d = new Date(ts);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messagesToMarkdown(messages: Message[]): string {
  const sessionDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [
    `# Neuravity AI — Sesi Coding`,
    ``,
    `> **Tanggal:** ${sessionDate}  `,
    `> **Jumlah pesan:** ${messages.length}  `,
    `> **Dibuat oleh:** Neuravity — Neurodivergent-Friendly Code Editor`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`### Kamu — ${formatTimestamp(msg.timestamp)}`);
      lines.push(``);
      lines.push(msg.content);
      lines.push(``);
    } else {
      lines.push(`### Neuravity AI — ${formatTimestamp(msg.timestamp)}`);
      lines.push(``);
      // Wrap code blocks if detected
      lines.push(msg.content);
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
  }

  lines.push(`*Catatan: Dokumen ini digenerate otomatis dari sesi coding di Neuravity.*`);
  return lines.join('\n');
}

export function exportChatHistory(messages: Message[]): void {
  if (messages.length === 0) {
    alert('Tidak ada pesan untuk diekspor.');
    return;
  }

  const markdown = messagesToMarkdown(messages);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `neuravity-sesi-${dateStr}.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Project Files → ZIP
// ─────────────────────────────────────────────

function flattenTree(nodes: FileNode[], basePath: string = ''): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  for (const node of nodes) {
    const fullPath = basePath ? `${basePath}/${node.name}` : node.name;
    if (node.type === 'file') {
      files.push({ path: fullPath, content: node.content ?? '' });
    } else if (node.children) {
      files.push(...flattenTree(node.children, fullPath));
    }
  }

  return files;
}

export async function exportProjectZip(fileTree: FileNode[], projectName?: string): Promise<void> {
  if (fileTree.length === 0) {
    alert('Tidak ada file untuk diekspor. Upload atau buat file terlebih dahulu.');
    return;
  }

  // Dynamic import to keep bundle lean
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const files = flattenTree(fileTree);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const name = projectName ?? 'neuravity-project';
  const filename = `${name}-${dateStr}.zip`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

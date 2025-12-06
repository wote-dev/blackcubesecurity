import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { TextFile } from '../types.js';

const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**'
];

const DEFAULT_PATTERNS = [
  '**/*.{js,ts,jsx,tsx,py,rb,go,java,php,env,config,json,yaml,yml}',
  '**/.env',
  '**/.env.*'
];

const MAX_BYTES = 1_000_000; // 1MB safeguard to keep scans fast

function readGitignore(root: string): string[] {
  try {
    const gitignorePath = path.join(root, '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((entry) => (entry.startsWith('/') ? entry.slice(1) : entry));
  } catch {
    return [];
  }
}

function isLikelyBinary(buffer: Buffer): boolean {
  let nonText = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const charCode = buffer[i];
    if (charCode === 0) return true;
    if (charCode < 7 || charCode > 127) nonText += 1;
  }
  return nonText / buffer.length > 0.3;
}

export async function gatherTextFiles(root: string): Promise<{ files: TextFile[]; skipped: number }> {
  const ignore = [...DEFAULT_IGNORES, ...readGitignore(root)];
  const entries = await fg(DEFAULT_PATTERNS, {
    cwd: root,
    absolute: true,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore
  });

  const files: TextFile[] = [];
  let skipped = 0;

  for (const filePath of entries) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size > MAX_BYTES) {
        skipped += 1;
        continue;
      }
      const preview = await fs.promises.readFile(filePath);
      if (isLikelyBinary(preview)) {
        skipped += 1;
        continue;
      }
      files.push({ path: filePath, content: preview.toString('utf8') });
    } catch {
      skipped += 1;
    }
  }

  return { files, skipped };
}



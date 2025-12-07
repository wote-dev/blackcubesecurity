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
const BINARY_PROBE_BYTES = 4096;
const CONCURRENCY = 12;

interface ScanFileOptions {
  maxBytes?: number;
  includeGlobs?: string[];
  excludeGlobs?: string[];
}

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

function readBlackcubeIgnore(root: string): string[] {
  try {
    const ignorePath = path.join(root, '.blackcubeignore');
    const content = fs.readFileSync(ignorePath, 'utf8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
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

async function asyncMapLimit<T, R>(
  items: T[],
  limit: number,
  iterator: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  const worker = async (): Promise<void> => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await iterator(items[current], current);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function gatherTextFiles(
  root: string,
  options: ScanFileOptions = {}
): Promise<{ files: TextFile[]; skipped: number }> {
  const ignore = [...DEFAULT_IGNORES, ...readGitignore(root), ...readBlackcubeIgnore(root), ...(options.excludeGlobs || [])];
  const patterns = options.includeGlobs?.length ? options.includeGlobs : DEFAULT_PATTERNS;

  const entries = await fg(patterns, {
    cwd: root,
    absolute: true,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore
  });

  const files: TextFile[] = [];
  let skipped = 0;
  const maxBytes = options.maxBytes ?? MAX_BYTES;

  const processEntry = async (filePath: string): Promise<void> => {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size > maxBytes) {
        skipped += 1;
        return;
      }

      const handle = await fs.promises.open(filePath, 'r');
      const probeBuffer = Buffer.alloc(Math.min(BINARY_PROBE_BYTES, stat.size));
      await handle.read(probeBuffer, 0, probeBuffer.length, 0);
      await handle.close();

      if (isLikelyBinary(probeBuffer)) {
        skipped += 1;
        return;
      }

      const content = await fs.promises.readFile(filePath, 'utf8');
      files.push({ path: filePath, content });
    } catch {
      skipped += 1;
    }
  };

  await asyncMapLimit(entries, CONCURRENCY, processEntry);

  return { files, skipped };
}






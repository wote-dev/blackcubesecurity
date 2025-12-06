import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import patterns from '../patterns/secrets.json' with { type: 'json' };
import { Finding, Severity } from '../types.js';

const compiled = patterns.map((p) => ({
  ...p,
  regex: new RegExp(p.pattern, 'gi')
}));

function repoExists(root: string): boolean {
  return fs.existsSync(path.join(root, '.git'));
}

function shouldSkipLine(line: string): boolean {
  return line.includes('blackcube-ignore');
}

export async function scanGitHistory(root: string, depth = 100): Promise<Finding[]> {
  if (!repoExists(root)) return [];

  const git = simpleGit({ baseDir: root });
  const log = await git.log({ maxCount: depth });
  const findings: Finding[] = [];

  for (const entry of log.all) {
    const hash = entry.hash;
    const diff = await git.show([`${hash}^!`, '--unified=0', '--stat']);
    const lines = diff.split('\n');
    let currentFile = '';

    for (const rawLine of lines) {
      if (rawLine.startsWith('+++ b/')) {
        const filePath = rawLine.replace('+++ b/', '').trim();
        currentFile = filePath === '/dev/null' ? '' : path.join(root, filePath);
        continue;
      }

      if (!rawLine.startsWith('+') || rawLine.startsWith('+++') || !currentFile) {
        continue;
      }

      const line = rawLine.slice(1);
      if (shouldSkipLine(line)) continue;

      compiled.forEach((pattern) => {
        pattern.regex.lastIndex = 0;
        if (!pattern.regex.test(line)) return;
        findings.push({
          severity: pattern.severity as Severity,
          type: `${pattern.id}-history`,
          message: `${pattern.description} (git history)`,
          file: currentFile,
          line: undefined,
          snippet: line.trim().slice(0, 200),
          pattern: pattern.pattern,
          fix: `${pattern.fix}. Remove from history using git-filter-repo and rotate credentials.`,
          commit: hash,
          commitDate: entry.date
        });
      });
    }
  }

  return findings;
}


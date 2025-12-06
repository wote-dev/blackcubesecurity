import patterns from '../patterns/secrets.json' with { type: 'json' };
import { Finding, TextFile, Severity } from '../types.js';

const compiled = patterns.map((p) => ({
  ...p,
  regex: new RegExp(p.pattern, 'gi')
}));

function shouldSkipLine(line: string): boolean {
  return line.includes('blackcube-ignore');
}

function isLikelyLottie(file: TextFile): boolean {
  const lowerPath = file.path.toLowerCase();
  if (lowerPath.endsWith('.lottie.json') || lowerPath.includes('/lottie/') || lowerPath.includes('\\lottie\\')) {
    return true;
  }
  if (!lowerPath.endsWith('.json')) return false;
  // Heuristic: Lottie JSON tends to include these structural keys; if several are present, treat as animation
  const markers = ['"assets"', '"layers"', '"ip"', '"op"', '"fr"', '"v"', '"ddd"'];
  const hits = markers.reduce((count, marker) => (file.content.includes(marker) ? count + 1 : count), 0);
  return hits >= 4;
}

export function scanSecrets(files: TextFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (isLikelyLottie(file)) continue;

    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (shouldSkipLine(line)) return;
      compiled.forEach((pattern) => {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (!match) return;
        findings.push({
          severity: pattern.severity as Severity,
          type: pattern.id,
          message: pattern.description,
          file: file.path,
          line: index + 1,
          snippet: line.trim().slice(0, 240),
          pattern: pattern.pattern,
          fix: pattern.fix
        });
      });
    });
  }

  return findings;
}


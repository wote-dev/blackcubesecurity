import patterns from '../patterns/vulnerabilities.json' with { type: 'json' };
import { Finding, TextFile, Severity } from '../types.js';

const compiled = patterns.map((p) => ({
  ...p,
  regex: new RegExp(p.pattern, 'gi')
}));

function shouldSkipLine(line: string): boolean {
  return line.includes('blackcube-ignore');
}

export function scanVulnerabilities(files: TextFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (shouldSkipLine(line)) return;
      compiled.forEach((pattern) => {
        pattern.regex.lastIndex = 0;
        if (!pattern.regex.test(line)) return;
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


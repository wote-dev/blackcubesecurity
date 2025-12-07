import fs from 'node:fs';
import path from 'node:path';
import { gatherTextFiles } from './utils/fileScanner.js';
import { filterBySeverity } from './utils/severity.js';
import { scanSecrets } from './scanners/secrets.js';
import { scanVulnerabilities } from './scanners/vulnerabilities.js';
import { scanDependencies } from './scanners/dependencies.js';
import { scanGitHistory } from './scanners/gitHistory.js';
import { Finding, ScanOptions, ScanOutput, Severity } from './types.js';

const DEFAULT_BASELINE = '.blackcube-baseline.json';

function findingKey(finding: Finding): string {
  const location = finding.file ?? finding.commit ?? 'unknown';
  const line = finding.line ?? 0;
  const pattern = finding.pattern ?? finding.message ?? '';
  return `${finding.type}|${location}|${line}|${pattern}`;
}

async function loadBaseline(root: string, baselinePath?: string): Promise<Set<string>> {
  if (!baselinePath) return new Set();
  const fullPath = path.isAbsolute(baselinePath) ? baselinePath : path.join(root, baselinePath);
  try {
    const raw = await fs.promises.readFile(fullPath, 'utf8');
    const parsed = JSON.parse(raw) as { findings?: Partial<Finding>[] };
    const list = parsed.findings ?? [];
    return new Set(list.map((f) => findingKey({
      severity: (f.severity as Severity) ?? 'low',
      type: f.type ?? '',
      message: f.message ?? '',
      file: f.file,
      line: f.line,
      pattern: f.pattern,
      commit: f.commit
    })));
  } catch {
    return new Set();
  }
}

export async function runScan(options: Partial<ScanOptions> = {}): Promise<ScanOutput> {
  const root = path.resolve(options.root ?? process.cwd());
  const commitDepth = options.commitDepth ?? 100;
  const start = Date.now();
  const timings: Record<string, number> = {};

  const time = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    options.onPhase?.(label, 'start');
    const t0 = Date.now();
    const result = await fn();
    timings[label] = Date.now() - t0;
    options.onPhase?.(label, 'end');
    return result;
  };

  const baseline = await loadBaseline(root, options.baselinePath ?? DEFAULT_BASELINE);

  const { files, skipped } = await time('files', () =>
    gatherTextFiles(root, {
      maxBytes: options.maxBytes,
      includeGlobs: options.includeGlobs,
      excludeGlobs: options.excludeGlobs
    })
  );

  const [secretFindings, vulnFindings, depFindings, historyFindings] = await Promise.all([
    time('secrets', () => Promise.resolve(scanSecrets(files))),
    time('vulnerabilities', () => Promise.resolve(scanVulnerabilities(files))),
    time('dependencies', () => scanDependencies(root)),
    options.skipHistory ? Promise.resolve([]) : time('history', () => scanGitHistory(root, commitDepth))
  ]);

  const combined = [
    ...secretFindings,
    ...vulnFindings,
    ...depFindings,
    ...historyFindings
  ];

  // Avoid flagging our own pattern definition files when scanning this repo locally.
  const selfFiltered = combined.filter((finding) => {
    if (!finding.file) return true;
    return !finding.file.includes('blackcubesecurity') || !finding.file.includes('/patterns/');
  });

  const filtered = filterBySeverity(selfFiltered, options.severity as Severity | undefined);
  const baselineFiltered = baseline.size
    ? filtered.filter((f) => !baseline.has(findingKey(f)))
    : filtered;
  const durationMs = Date.now() - start;

  return {
    findings: baselineFiltered,
    stats: {
      scannedFiles: files.length,
      skippedFiles: skipped,
      historyScanned: !options.skipHistory,
      durationMs
    },
    timings
  };
}


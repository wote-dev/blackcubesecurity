import path from 'node:path';
import { gatherTextFiles } from './utils/fileScanner.js';
import { filterBySeverity } from './utils/severity.js';
import { scanSecrets } from './scanners/secrets.js';
import { scanVulnerabilities } from './scanners/vulnerabilities.js';
import { scanDependencies } from './scanners/dependencies.js';
import { scanGitHistory } from './scanners/gitHistory.js';
import { Finding, ScanOptions, ScanOutput, Severity } from './types.js';

export async function runScan(options: Partial<ScanOptions> = {}): Promise<ScanOutput> {
  const root = path.resolve(options.root ?? process.cwd());
  const commitDepth = options.commitDepth ?? 100;
  const start = Date.now();

  const { files, skipped } = await gatherTextFiles(root);

  const [secretFindings, vulnFindings, depFindings, historyFindings] = await Promise.all([
    Promise.resolve(scanSecrets(files)),
    Promise.resolve(scanVulnerabilities(files)),
    scanDependencies(root),
    options.skipHistory ? Promise.resolve([]) : scanGitHistory(root, commitDepth)
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
  const durationMs = Date.now() - start;

  return {
    findings: filtered,
    stats: {
      scannedFiles: files.length,
      skippedFiles: skipped,
      historyScanned: !options.skipHistory,
      durationMs
    }
  };
}


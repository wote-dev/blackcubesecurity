import { createRequire } from 'module';
import { ScanOutput } from '../types.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { version?: string };

export function renderJson(result: ScanOutput): string {
  const payload = {
    meta: {
      tool: 'blackcube-security',
      version: packageJson.version ?? 'unknown',
      generatedAt: new Date().toISOString()
    },
    findings: result.findings,
    stats: result.stats
  };

  return JSON.stringify(payload, null, 2);
}


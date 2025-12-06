import { ScanOutput } from '../types.js';
import packageJson from '../../package.json' with { type: 'json' };

export function renderJson(result: ScanOutput): string {
  const payload = {
    meta: {
      tool: 'blackcube-security',
      version: packageJson.version,
      generatedAt: new Date().toISOString()
    },
    findings: result.findings,
    stats: result.stats
  };

  return JSON.stringify(payload, null, 2);
}


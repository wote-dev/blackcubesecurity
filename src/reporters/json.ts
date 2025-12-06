import { ScanOutput } from '../types.js';

export function renderJson(result: ScanOutput): string {
  const payload = {
    meta: {
      tool: 'blackcube-security',
      version: '1.0.0',
      generatedAt: new Date().toISOString()
    },
    findings: result.findings,
    stats: result.stats
  };

  return JSON.stringify(payload, null, 2);
}


import fs from 'node:fs';
import path from 'node:path';
import { Finding, Severity } from '../types.js';

interface VulnRule {
  pkg: string;
  threshold?: string;
  severity: Severity;
  message: string;
  fix: string;
}

const RULES: VulnRule[] = [
  {
    pkg: 'event-stream',
    severity: 'critical',
    message: 'event-stream package was compromised in the past',
    fix: 'Remove dependency or replace with maintained alternative'
  },
  {
    pkg: 'minimist',
    threshold: '1.2.6',
    severity: 'high',
    message: 'minimist <1.2.6 vulnerable to prototype pollution',
    fix: 'Upgrade minimist to >=1.2.6'
  },
  {
    pkg: 'lodash',
    threshold: '4.17.21',
    severity: 'medium',
    message: 'lodash <4.17.21 vulnerable to prototype pollution',
    fix: 'Upgrade lodash to >=4.17.21'
  }
];

function normalizeVersion(version: string): [number, number, number] | null {
  const cleaned = version.replace(/^[^0-9]*/, '').trim();
  const match = cleaned.match(/(\\d+)\\.(\\d+)\\.(\\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isLessThan(version: string, threshold: string): boolean {
  const v = normalizeVersion(version);
  const t = normalizeVersion(threshold);
  if (!v || !t) return false;
  for (let i = 0; i < 3; i += 1) {
    if (v[i] < t[i]) return true;
    if (v[i] > t[i]) return false;
  }
  return false;
}

export async function scanDependencies(root: string): Promise<Finding[]> {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];

  const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  const findings: Finding[] = [];

  Object.entries(allDeps).forEach(([name, version]) => {
    if (version === '*' || version === 'latest') {
      findings.push({
        severity: 'low',
        type: 'unpinned-dependency',
        message: `Dependency ${name} is unpinned (${version})`,
        file: pkgPath,
        snippet: `${name}: ${version}`,
        fix: 'Pin dependency to a specific secure version'
      });
      return;
    }

    RULES.forEach((rule) => {
      if (rule.pkg !== name) return;
      if (!rule.threshold || isLessThan(version, rule.threshold)) {
        findings.push({
          severity: rule.severity,
          type: `${rule.pkg}-dependency`,
          message: rule.message,
          file: pkgPath,
          snippet: `${name}: ${version}`,
          fix: rule.fix
        });
      }
    });
  });

  return findings;
}



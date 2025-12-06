import { Severity, Finding } from '../types.js';

const order: Severity[] = ['critical', 'high', 'medium', 'low'];

export const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export function meetsThreshold(severity: Severity, threshold?: Severity): boolean {
  if (!threshold) return true;
  return severityRank[severity] >= severityRank[threshold];
}

export function filterBySeverity(findings: Finding[], min?: Severity): Finding[] {
  if (!min) return findings;
  return findings.filter((f) => meetsThreshold(f.severity, min));
}

export function exitCodeFor(findings: Finding[]): number {
  const highest = findings.reduce<Severity | null>((acc, curr) => {
    if (!acc) return curr.severity;
    return severityRank[curr.severity] > severityRank[acc] ? curr.severity : acc;
  }, null);

  if (!highest) return 0;
  if (highest === 'critical' || highest === 'high') return 2;
  return 1;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[b.severity] - severityRank[a.severity];
    }
    if (a.file && b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.message.localeCompare(b.message);
  });
}

export function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  return order.reduce((acc, level) => {
    acc[level] = findings.filter((f) => f.severity === level);
    return acc;
  }, {} as Record<Severity, Finding[]>);
}


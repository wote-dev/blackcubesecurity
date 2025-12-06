import chalk from 'chalk';
import { groupBySeverity, sortFindings } from '../utils/severity.js';
import { ScanOutput, Severity } from '../types.js';

const ICONS: Record<Severity, string> = {
  critical: '[!!]',
  high: '[! ]',
  medium: '[- ]',
  low: '[..]'
};

type Colorizer = (input: string) => string;

const COLOR: Record<Severity, Colorizer> = {
  critical: chalk.redBright,
  high: chalk.yellowBright,
  medium: chalk.cyanBright,
  low: chalk.gray
};

const ACCENT = chalk.hex('#7c3aed');
const MUTED = chalk.gray;
const LABEL = chalk.bgBlack.white.bold;

function divider(label: string) {
  const line = '─'.repeat(Math.max(10, 54 - label.length));
  return `${MUTED('┌')} ${ACCENT(label)} ${MUTED(line)}`;
}

function statLine(label: string, value: string) {
  return `${MUTED('│')} ${MUTED(label.padEnd(12))}${value}`;
}

export function renderConsole(result: ScanOutput, verbose = false): void {
  const grouped = groupBySeverity(result.findings);
  const total = result.findings.length;
  const summaryLine = `Summary: ${total} issues found | critical ${grouped.critical.length} | high ${grouped.high.length} | medium ${grouped.medium.length} | low ${grouped.low.length}`;

  console.log(`${LABEL(' BLACKCUBE ')} ${ACCENT('security scan')}`);
  console.log(MUTED('────────────────────────────────────────────────────────'));

  const badges = (['critical', 'high', 'medium', 'low'] as Severity[])
    .map((level) => COLOR[level](`${level.toUpperCase().padEnd(7)} ${grouped[level].length.toString().padStart(2, '0')}`))
    .join(MUTED('  '));
  console.log(badges);
  console.log(divider('stats'));
  console.log(statLine('files', `${result.stats.scannedFiles} scanned (${result.stats.skippedFiles} skipped)`));
  console.log(statLine('history', result.stats.historyScanned ? 'scanned' : 'skipped'));
  console.log(statLine('duration', `${result.stats.durationMs}ms`));
  console.log(MUTED('└───────────────────────────────────────────────────────'));
  console.log('');

  (['critical', 'high', 'medium', 'low'] as Severity[]).forEach((level) => {
    const items = sortFindings(grouped[level]);
    if (!items.length) return;
    console.log(`${ICONS[level]} ${chalk.bold(COLOR[level](level.toUpperCase()))} ${COLOR[level](`(${items.length} issues)`)}`);
    items.forEach((item) => {
      const location = item.file ? `File: ${item.file}${item.line ? `:${item.line}` : ''}` : item.commit ? `Commit: ${item.commit}` : '';
      console.log(`  • ${chalk.bold(item.message)}`);
      if (location) console.log(`    ${MUTED(location)}`);
      if (item.pattern) console.log(`    Pattern: ${item.pattern}`);
      if (item.snippet && verbose) console.log(`    Code: ${item.snippet}`);
      if (item.fix) console.log(`    Fix: ${item.fix}`);
      console.log('');
    });
  });

  if (!total) {
    console.log(chalk.greenBright('CLEAN — no blocking issues found.'));
  } else {
    console.log(MUTED(summaryLine));
  }

  console.log('');
}


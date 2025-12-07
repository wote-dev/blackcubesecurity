import chalk, { Chalk } from 'chalk';
import { groupBySeverity, sortFindings } from '../utils/severity.js';
import { ScanOutput, Severity } from '../types.js';

const ICONS: Record<Severity, string> = {
  critical: '[!!]',
  high: '[! ]',
  medium: '[- ]',
  low: '[..]'
};

type Colorizer = (input: string) => string;

interface ConsoleRenderOptions {
  verbose?: boolean;
  summaryOnly?: boolean;
  noColor?: boolean;
  limit?: number;
  timings?: Record<string, number>;
}

export function renderConsole(result: ScanOutput, options: ConsoleRenderOptions = {}): void {
  const palette = options.noColor ? new Chalk({ level: 0 }) : chalk;

  const COLOR: Record<Severity, Colorizer> = {
    critical: palette.redBright,
    high: palette.yellowBright,
    medium: palette.cyanBright,
    low: palette.gray
  };

  const ACCENT = palette.hex('#7c3aed');
  const MUTED = palette.gray;
  const LABEL = palette.bgBlack.white.bold;

  const divider = (label: string) => {
    const line = '─'.repeat(Math.max(10, 54 - label.length));
    return `${MUTED('┌')} ${ACCENT(label)} ${MUTED(line)}`;
  };

  const statLine = (label: string, value: string) => `${MUTED('│')} ${MUTED(label.padEnd(12))}${value}`;

  const total = result.findings.length;
  const limit = options.limit && options.limit > 0 ? options.limit : undefined;
  const limitedFindings = limit ? sortFindings(result.findings).slice(0, limit) : result.findings;
  const limitedGrouped = groupBySeverity(limitedFindings);
  const fullGrouped = groupBySeverity(result.findings);

  const summaryLine = `Summary: ${total} issues found | critical ${fullGrouped.critical.length} | high ${fullGrouped.high.length} | medium ${fullGrouped.medium.length} | low ${fullGrouped.low.length}`;

  console.log(`${LABEL(' BLACKCUBE ')} ${ACCENT('security scan')}`);
  console.log(MUTED('────────────────────────────────────────────────────────'));

  const badges = (['critical', 'high', 'medium', 'low'] as Severity[])
    .map((level) => COLOR[level](`${level.toUpperCase().padEnd(7)} ${fullGrouped[level].length.toString().padStart(2, '0')}`))
    .join(MUTED('  '));
  console.log(badges);
  console.log(divider('stats'));
  console.log(statLine('files', `${result.stats.scannedFiles} scanned (${result.stats.skippedFiles} skipped)`));
  console.log(statLine('history', result.stats.historyScanned ? 'scanned' : 'skipped'));
  console.log(statLine('duration', `${result.stats.durationMs}ms`));
  if (options.timings && Object.keys(options.timings).length) {
    const timingLine = Object.entries(options.timings)
      .map(([phase, ms]) => `${phase}:${ms}ms`)
      .join('  ');
    console.log(statLine('phases', timingLine));
  }
  console.log(MUTED('└───────────────────────────────────────────────────────'));
  console.log('');

  if (!total) {
    console.log(palette.greenBright('CLEAN — no blocking issues found.'));
    console.log('');
    return;
  }

  console.log(MUTED(summaryLine));
  if (limit && limit < total) {
    console.log(MUTED(`Showing ${limit} of ${total} findings (use --top/--max-findings to adjust).`));
  }
  console.log('');

  if (options.summaryOnly) {
    return;
  }

  (['critical', 'high', 'medium', 'low'] as Severity[]).forEach((level) => {
    const items = sortFindings(limitedGrouped[level]);
    if (!items.length) return;
    console.log(`${ICONS[level]} ${palette.bold(COLOR[level](level.toUpperCase()))} ${COLOR[level](`(${items.length} issues)`)}`);
    items.forEach((item) => {
      const location = item.file ? `File: ${item.file}${item.line ? `:${item.line}` : ''}` : item.commit ? `Commit: ${item.commit}` : '';
      console.log(`  • ${palette.bold(item.message)}`);
      if (location) console.log(`    ${MUTED(location)}`);
      if (item.pattern) console.log(`    Pattern: ${item.pattern}`);
      if (item.snippet && options.verbose) console.log(`    Code: ${item.snippet}`);
      if (item.fix) console.log(`    Fix: ${item.fix}`);
      console.log('');
    });
  });

  console.log('');
}

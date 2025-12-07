import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { runScan } from './index.js';
import { renderConsole } from './reporters/console.js';
import { renderJson } from './reporters/json.js';
import { exitCodeFor } from './utils/severity.js';
import { Severity } from './types.js';

const program = new Command();

program
  .name('blackcube')
  .description('Scan codebases for exposed secrets and common security vulnerabilities')
  .version('1.0.7');

program
  .command('scan')
  .argument('[target]', 'Path to repository', '.')
  .option('--json', 'Output JSON format')
  .option('--skip-history', 'Skip git history scanning')
  .option('--severity <level>', 'Minimum severity to report (critical|high|medium|low)')
  .option('--verbose', 'Show detailed snippets', false)
  .option('--commit-depth <n>', 'Number of commits to scan from history (default 100)', '100')
  .option('--summary-only', 'Only print summary and stats')
  .option('--no-color', 'Disable ANSI colors')
  .option('--top <n>', 'Show only the top N findings (by severity)', (v) => Number(v))
  .option('--max-findings <n>', 'Limit total findings shown', (v) => Number(v))
  .option('--max-bytes <n>', 'Maximum file size to scan (bytes)', (v) => Number(v))
  .option('--include <globs...>', 'Additional include globs (override defaults)')
  .option('--exclude <globs...>', 'Exclude globs')
  .option('--baseline <path>', 'Path to baseline file', '.blackcube-baseline.json')
  .option('--update-baseline', 'Write current findings to the baseline file')
  .action(async (target, options) => {
    const totalPhases = options.skipHistory ? 4 : 5;
    let completedPhases = 0;
    const spinner = ora('Scanning files…').start();

    const onPhase = (phase: string, stage: 'start' | 'end') => {
      if (stage === 'start') {
        spinner.text = `Scanning ${phase} (${completedPhases + 1}/${totalPhases})`;
      } else {
        completedPhases += 1;
        spinner.text = `Completed ${phase} (${completedPhases}/${totalPhases})`;
      }
    };

    const resolvedRoot = path.resolve(target);
    const baselinePath = options.baseline ? String(options.baseline) : undefined;

    try {
      const result = await runScan({
        root: target,
        skipHistory: Boolean(options.skipHistory),
        severity: options.severity as Severity | undefined,
        verbose: Boolean(options.verbose),
        json: Boolean(options.json),
        commitDepth: Number(options.commitDepth) || 100,
        maxBytes: options.maxBytes || undefined,
        includeGlobs: options.include,
        excludeGlobs: options.exclude,
        baselinePath,
        onPhase
      });
      spinner.stop();

      if (options.json) {
        console.log(renderJson(result));
      } else {
        const limit =
          typeof options.maxFindings === 'number' && options.maxFindings > 0
            ? options.maxFindings
            : typeof options.top === 'number' && options.top > 0
            ? options.top
            : undefined;

        renderConsole(result, {
          verbose: Boolean(options.verbose),
          summaryOnly: Boolean(options.summaryOnly),
          noColor: options.color === false,
          limit,
          timings: result.timings
        });
      }

      if (options.updateBaseline && baselinePath) {
        const fullBaseline = path.isAbsolute(baselinePath)
          ? baselinePath
          : path.join(resolvedRoot, baselinePath);
        const payload = {
          updatedAt: new Date().toISOString(),
          findings: result.findings
        };
        await fs.promises.writeFile(fullBaseline, JSON.stringify(payload, null, 2), 'utf8');
        console.log(chalk.gray(`Baseline updated at ${fullBaseline}`));
      }

      const code = exitCodeFor(result.findings);
      if (code === 0) {
        console.log(chalk.greenBright('CLEAN — no blocking issues detected.'));
      }
      process.exit(code);
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(error);
      process.exit(1);
    }
  });

program.addHelpText(
  'after',
  `
\nExamples:
  npx blackcube scan
  npx blackcube scan ./path/to/repo
  npx blackcube scan --json
  npx blackcube scan --skip-history --severity critical
  npx blackcube scan --verbose
  # legacy alias (if installed locally): npx blackcube-security scan
`
);

program.parseAsync(process.argv);


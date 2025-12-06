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
  .version('1.0.3');

program
  .command('scan')
  .argument('[target]', 'Path to repository', '.')
  .option('--json', 'Output JSON format')
  .option('--skip-history', 'Skip git history scanning')
  .option('--severity <level>', 'Minimum severity to report (critical|high|medium|low)')
  .option('--verbose', 'Show detailed snippets', false)
  .option('--commit-depth <n>', 'Number of commits to scan from history (default 100)', '100')
  .action(async (target, options) => {
    const spinner = ora('Scanning...').start();
    try {
      const result = await runScan({
        root: target,
        skipHistory: Boolean(options.skipHistory),
        severity: options.severity as Severity | undefined,
        verbose: Boolean(options.verbose),
        json: Boolean(options.json),
        commitDepth: Number(options.commitDepth) || 100
      });
      spinner.stop();

      if (options.json) {
        console.log(renderJson(result));
      } else {
        renderConsole(result, Boolean(options.verbose));
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


const { spawnSync } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'pnpm' : 'pnpm';

function quoteForShell(value) {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/gu, '\\"')}"`;
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(
    isWindows ? `${command} ${args.map(quoteForShell).join(' ')}` : command,
    isWindows ? [] : args,
    {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(pnpmCommand, ['run', 'build:desktop']);
run(pnpmCommand, ['run', 'prepare:desktop']);
run(pnpmCommand, ['exec', 'electron-builder', '--win', 'nsis', ...process.argv.slice(2)]);
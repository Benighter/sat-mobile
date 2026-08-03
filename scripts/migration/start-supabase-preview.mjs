import { spawn } from 'node:child_process';
import { closeSync, openSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_REF = 'ftbsocbwxbfqejapdthj';

const supabaseBinary = () => {
  const packageDirectory = realpathSync(resolve(process.cwd(), 'node_modules', 'supabase'));
  return resolve(packageDirectory, '..', '@supabase', 'cli-windows-x64', 'bin', 'supabase.exe');
};

const capture = (executable, args) => new Promise((resolvePromise, rejectPromise) => {
  const child = spawn(executable, args, { cwd: process.cwd(), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.on('error', () => rejectPromise(new Error('Preview configuration process could not start')));
  child.on('close', (code) => code === 0 ? resolvePromise(stdout) : rejectPromise(new Error('Preview configuration was unavailable')));
});

const raw = await capture(supabaseBinary(), [
  '--agent', 'no', '--output-format', 'text', '--output', 'json',
  'projects', 'api-keys', '--project-ref', PROJECT_REF,
]);
const keys = JSON.parse(raw);
const publishableKey = keys.find((item) => item?.type === 'publishable')?.api_key;
if (!publishableKey) throw new Error('Supabase publishable configuration was unavailable');

const command = process.execPath;
const args = [resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')];
const stdoutFd = openSync(resolve(process.cwd(), 'migration-artifacts', 'supabase-dev.stdout.log'), 'w');
const stderrFd = openSync(resolve(process.cwd(), 'migration-artifacts', 'supabase-dev.stderr.log'), 'w');
const child = spawn(command, args, {
  cwd: process.cwd(),
  detached: true,
  windowsHide: true,
  shell: false,
  stdio: ['ignore', stdoutFd, stderrFd],
  env: {
    ...process.env,
    VITE_DATA_BACKEND: 'supabase',
    VITE_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    VITE_SUPABASE_STORAGE_BUCKET: 'sat-mobile-media',
    VITE_FIREBASE_ROLLBACK_WRITES: 'true',
  },
});
child.unref();
closeSync(stdoutFd);
closeSync(stderrFd);
process.stdout.write(JSON.stringify({ started: true, processId: child.pid, publishableKeyPersisted: false, secretKeyRequested: false }));

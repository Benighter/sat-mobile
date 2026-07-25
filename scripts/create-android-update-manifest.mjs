import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const parseArguments = (items) => {
  const result = {};
  for (let index = 0; index < items.length; index += 2) {
    const key = items[index];
    const value = items[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}. Expected --name value.`);
    }
    result[key.slice(2)] = value;
  }
  return result;
};

const parseProperties = (source) => Object.fromEntries(
  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      if (separator < 1) throw new Error(`Invalid version property: ${line}`);
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const args = parseArguments(process.argv.slice(2));
for (const required of ['apk', 'output', 'apk-url']) {
  if (!args[required]) throw new Error(`Missing required --${required} argument.`);
}

const apkPath = path.resolve(args.apk);
const outputPath = path.resolve(args.output);
const apkUrl = new URL(args['apk-url']);
if (apkUrl.protocol !== 'https:') throw new Error('The APK URL must use HTTPS.');

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const versionProperties = parseProperties(
  await readFile(new URL('../android/version.properties', import.meta.url), 'utf8'),
);
const versionCode = Number.parseInt(versionProperties.VERSION_CODE, 10);
const versionName = versionProperties.VERSION_NAME;
if (!Number.isSafeInteger(versionCode) || versionCode <= 0) throw new Error('VERSION_CODE must be a positive integer.');
if (!versionName) throw new Error('VERSION_NAME is required.');
if (packageJson.version !== versionName) {
  throw new Error(`package.json version ${packageJson.version} does not match Android VERSION_NAME ${versionName}.`);
}

const apk = await readFile(apkPath);
const apkStats = await stat(apkPath);
if (apkStats.size > 250 * 1024 * 1024) throw new Error('APK exceeds the updater 250 MB safety limit.');
const releaseNotes = args['notes-file']
  ? (await readFile(path.resolve(args['notes-file']), 'utf8')).trim()
  : (args.notes ?? `SAT Mobile ${versionName}`);
if (releaseNotes.length > 4_000) throw new Error('Release notes exceed the updater 4,000 character limit.');
const publishedAt = args['published-at'] ?? new Date().toISOString();
if (Number.isNaN(Date.parse(publishedAt))) throw new Error('--published-at must be an ISO-8601 date.');

const manifest = {
  schemaVersion: 1,
  packageName: 'com.benighter.satmobile',
  versionCode,
  versionName,
  apkUrl: apkUrl.toString(),
  sha256: createHash('sha256').update(apk).digest('hex'),
  sizeBytes: apkStats.size,
  releaseNotes,
  publishedAt,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote Android update manifest for ${versionName} (${versionCode}) to ${outputPath}`);

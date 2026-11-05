import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const PRIVACY_MIGRATIONS = {
  '20261104195228_privacy_data_lifecycle.sql': '5e9f0f3acf612556a0c6b58ad96cf27d44c070e86ba894b90c0bc082ba4be2ab',
  '20261105013646_privacy_observer_erasure.sql': 'f0c94a288120fbd4bbedefa1d5f417ff8fd9d9ce4be87e7aebcb071bb4cec4b4',
};
const schedules = [
  ['/api/cron/privacy-retention-sweep', '15 * * * *'],
  ['/api/cron/account-deletion-sweep', '0 17 * * *'],
  ['/api/cron/assessment-resume-reminders', '*/5 * * * *'],
  ['/api/cron/assessment-timing-sweep', '*/5 * * * *'],
  ['/api/cron/report-generation-sweep', '*/5 * * * *'],
  ['/api/cron/report-pdf-sweep', '* * * * *'],
  ['/api/cron/usage-billing', '0 2 1 * *'],
  ['/api/cron/outcome-analysis-sweep', '*/5 * * * *'],
  ['/api/cron/public-builds-retention-sweep', '0 18 * * *'],
];

/** Source-only guard. It does not inspect or change a provider/database. */
export function verifySydneyCutoverFiles(directory) {
  for (const [name, expected] of Object.entries(PRIVACY_MIGRATIONS)) {
    const digest = createHash('sha256').update(readFileSync(resolve(directory, 'supabase/migrations', name))).digest('hex');
    if (digest !== expected) throw new Error(`Reviewed privacy migration changed: ${name}`);
  }
  const config = JSON.parse(readFileSync(resolve(directory, 'vercel.json'), 'utf8'));
  const actual = config.crons?.map(({ path, schedule }) => [path, schedule]);
  const canonical = entries => JSON.stringify([...entries].sort(([a], [b]) => a.localeCompare(b)));
  if (!Array.isArray(actual) || canonical(actual) !== canonical(schedules)) throw new Error('Cutover must retain all nine reviewed cron schedules.');
  if (JSON.stringify(config.regions) !== '["syd1"]') throw new Error('Cutover must retain Sydney functions.');
  return { privacyMigrations: PRIVACY_MIGRATIONS, cronCount: actual.length, region: 'syd1' };
}

export function verifySydneyCutoverCommit(directory, expectedHead) {
  if (!/^[a-f0-9]{40}$/.test(expectedHead ?? '')) throw new Error('Provide the exact approved 40-character candidate SHA.');
  const git = args => {
    const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error('Candidate identity or current-main ancestry check failed. Refresh and review before cutover.');
    return result.stdout.trim();
  };
  const head = git(['rev-parse', 'HEAD']);
  if (head !== expectedHead) throw new Error('Checkout differs from the approved cutover SHA.');
  if (git(['status', '--porcelain', '--untracked-files=all'])) throw new Error('Cutover checkout must be clean before checking the approved source.');
  const main = git(['rev-parse', 'origin/main']);
  git(['merge-base', '--is-ancestor', main, head]);
  return { head, main, ...verifySydneyCutoverFiles(directory) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(verifySydneyCutoverCommit(root, process.argv[2]), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Cutover source check failed.');
    process.exitCode = 1;
  }
}

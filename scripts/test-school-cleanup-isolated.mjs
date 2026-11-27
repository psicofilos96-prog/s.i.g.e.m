// Runs only against a new, socket-only PostgreSQL under /tmp; never reads connection secrets.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = mkdtempSync(join(tmpdir(), 'sigem-cleanup-test-'));
const env = { PATH: process.env['PATH'] ?? '/usr/bin:/bin', HOME: dir, LC_ALL: 'C' };
const run = (program, args, input) => {
  const result = spawnSync(program, args, { env, input, encoding: 'utf8', timeout: 120_000, maxBuffer: 2_000_000 });
  if (result.status !== 0) throw new Error(`${program}: ${result.stderr || result.stdout}`);
  return result.stdout;
};
const pg = (program, args) => run('setpriv', ['--reuid=1000', '--regid=1000', '--clear-groups', program, ...args]);
try {
  run('chown', ['lovable', dir]);
  pg('initdb', ['-D', join(dir, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale']);
  pg('pg_ctl', ['-D', join(dir, 'data'), '-l', join(dir, 'server.log'), '-o', `-k ${dir} -p 56549 -c listen_addresses=''`, '-w', 'start']);
  const source = readFileSync('drizzle/migrations/0633_test_school_99999901_fail_closed_cleanup.sql', 'utf8');
  const fixture = readFileSync('supabase/tests/test_school_cleanup_fail_closed.sql', 'utf8');
  const assertions = readFileSync('supabase/tests/test_school_cleanup_assertions.sql', 'utf8');
  const out = run('psql', ['-X', '-h', dir, '-p', '56549', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'], fixture + '\n' + source + '\n' + assertions);
  console.log(out.split('\n').filter(line => line.startsWith('PASS ')).join('\n'));
} finally {
  try { pg('pg_ctl', ['-D', join(dir, 'data'), '-m', 'immediate', '-w', 'stop']); } catch { /* initialization can fail */ }
  rmSync(dir, { recursive: true, force: true });
}

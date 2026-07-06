import { spawnSync } from 'node:child_process';

const banned = String.fromCharCode(99, 108, 101, 114, 107);
const result = spawnSync('git', ['grep', '-n', '-i', '--', banned, '--', '.'], {
  encoding: 'utf8',
});

if (result.status === 1) {
  process.exit(0);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.stderr.write(result.stdout);
process.exit(1);

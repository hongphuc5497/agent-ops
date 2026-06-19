#!/usr/bin/env node
// Concurrent-claim race: two agents race to claim the same path. With state
// locking, exactly one should succeed and the other should see a clean
// "claim conflict" error — never two writers stomping the file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-lock-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'TASK.md'), '# Active Task\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  return dir;
}

function ok(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function runSync(args, cwd) {
  return spawnSync('python3', [tool, ...args], { cwd, encoding: 'utf8' });
}

function runAsync(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn('python3', [tool, ...args], { cwd, encoding: 'utf8' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

async function testConcurrentClaimsHaveExactlyOneWinner() {
  const repo = makeRepo();
  ok(runSync(['start', 'Race task', '--owner', 'Codex'], repo), 'start');

  // Race N agents — each with a DISTINCT owner — to claim the same path on
  // the active task. The conflict rule rejects same-task-different-owner
  // overlaps, so only the first writer can win. Without locking, multiple
  // racers would read the empty claim list, all pass the check, and all
  // write — the file would end up with multiple conflicting rows.
  const racers = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      runAsync(['claim', 'src/contested.ts', '--owner', `agent${i}`], repo),
    ),
  );

  const winners = racers.filter((r) => r.status === 0);
  const losers = racers.filter((r) => r.status !== 0);

  assert.equal(winners.length, 1, `expected one winner, got ${winners.length}`);
  assert.equal(losers.length, 7, `expected seven losers, got ${losers.length}`);
  for (const loser of losers) {
    const payload = JSON.parse(loser.stdout);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /claim conflict/);
  }

  // Final state: exactly one claim row, no torn writes.
  const claims = JSON.parse(
    fs.readFileSync(path.join(repo, '.ai', 'state', 'file-claims.json'), 'utf8'),
  );
  assert.equal(claims.claims.length, 1);
  assert.deepEqual(claims.claims[0].paths, ['src/contested.ts']);
}

async function testAtomicWriteSurvivesCorruptStartingState() {
  // A pre-existing corrupt claims file should surface a structured error
  // instead of a stack trace, and should NOT be silently overwritten.
  const repo = makeRepo();
  fs.writeFileSync(
    path.join(repo, '.ai', 'state', 'file-claims.json'),
    '{ "claims": "not an array" }',
  );
  ok(runSync(['start', 'Corrupt repro', '--owner', 'Codex'], repo), 'start');

  const result = runSync(['claim', 'src/foo.ts'], repo);
  assert.notEqual(result.status, 0, 'claim should fail with corrupt state');
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.ok(
    Array.isArray(payload.problems) && payload.problems.length > 0,
    'validation problems should be reported',
  );
}

(async () => {
  await testConcurrentClaimsHaveExactlyOneWinner();
  await testAtomicWriteSurvivesCorruptStartingState();
  console.log('locking tests passed');
})();

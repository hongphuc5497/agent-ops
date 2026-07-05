#!/usr/bin/env node
// claim --release: the crash-recovery path. Must work WITHOUT an active task
// (that's the point), match owners by default, audit forced releases, and
// support partial release of multi-path claims.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-release-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'TASK.md'), '# Active Task\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  return dir;
}

function run(args, cwd, env = {}) {
  return spawnSync('python3', [tool, ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, ...env },
  });
}

function ok(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

function claims(repo) {
  return JSON.parse(
    fs.readFileSync(path.join(repo, '.ai', 'state', 'file-claims.json'), 'utf8'),
  ).claims;
}

// --- orphan recovery: release works with NO active task
{
  const repo = makeRepo();
  ok(run(['start', 'Crash sim', '--owner', 'codex'], repo), 'start');
  ok(run(['claim', 'src/a.ts', 'src/b.ts', '--owner', 'codex'], repo), 'claim');
  // simulate a crash: delete the active task, claims remain orphaned
  fs.rmSync(path.join(repo, '.ai', 'state', 'active-task.json'));
  assert.equal(claims(repo).length, 1, 'orphan claim persists after crash');

  // doctor reports the orphan
  const doctor = run(['doctor'], repo);
  const doctorPayload = JSON.parse(doctor.stdout);
  assert.equal(doctorPayload.claims.orphans.length, 1);
  assert.match(doctorPayload.claims.remedy, /--release/);

  // check surfaces the orphan as a warning — and warnings alone never flip ok
  // (the fixture legitimately fails check on missing protocol files, so
  // assert the warning shape and that ok ignores it, not the exit code)
  const check = run(['check'], repo);
  const checkPayload = JSON.parse(check.stdout);
  assert.equal(checkPayload.warnings.orphan_claims.length, 1);
  assert.ok(
    checkPayload.ok === (checkPayload.missing.length === 0),
    'warnings must not affect ok — only missing files do here',
  );

  // owner releases without any active task
  ok(run(['claim', '--release', 'src/a.ts', 'src/b.ts', '--owner', 'codex'], repo), 'release');
  assert.equal(claims(repo).length, 0);
}

// --- owner matching + forced release with audit
{
  const repo = makeRepo();
  ok(run(['start', 'Owner match', '--owner', 'codex'], repo), 'start');
  ok(run(['claim', 'lib/*', '--owner', 'codex'], repo), 'claim');

  const denied = run(['claim', '--release', 'lib/*', '--owner', 'claude'], repo);
  assert.notEqual(denied.status, 0, 'foreign release without --force must fail');
  assert.match(JSON.parse(denied.stdout).error, /owned by someone else/);

  const noReason = run(['claim', '--release', 'lib/*', '--owner', 'claude', '--force'], repo);
  assert.notEqual(noReason.status, 0, '--force without --reason must fail');

  ok(
    run(['claim', '--release', 'lib/*', '--owner', 'claude', '--force', '--reason', 'agent crashed'], repo),
    'forced release',
  );
  assert.equal(claims(repo).length, 0);
  const audit = fs.readFileSync(path.join(repo, '.ai', 'state', 'handoffs.jsonl'), 'utf8');
  assert.match(audit, /forced claim release: agent crashed/);
}

// --- partial release of a multi-path claim
{
  const repo = makeRepo();
  ok(run(['start', 'Partial', '--owner', 'codex'], repo), 'start');
  ok(run(['claim', 'a.ts', 'b.ts', 'c.ts', '--owner', 'codex'], repo), 'claim');
  ok(run(['claim', '--release', 'b.ts', '--owner', 'codex'], repo), 'partial release');
  assert.deepEqual(claims(repo)[0].paths, ['a.ts', 'c.ts']);
}

// --- release-all for one owner, identity via AGENT_OPS_OWNER
{
  const repo = makeRepo();
  ok(run(['start', 'All mine', '--owner', 'codex'], repo), 'start');
  ok(run(['claim', 'x.ts', '--owner', 'codex'], repo), 'claim');
  ok(run(['claim', '--release', '--release-all'], repo, { AGENT_OPS_OWNER: 'codex' }), 'release-all');
  assert.equal(claims(repo).length, 0);
}

console.log('claim release tests passed');

#!/usr/bin/env node
// No-fcntl platforms (Windows): state mutations must be REFUSED with a
// structured error naming the override, not silently run unlocked. Read-only
// commands keep working. Both CI OSes have fcntl, so the missing module is
// simulated with a PYTHONPATH shim whose import raises ImportError — there is
// no Windows CI; this shim is the only automated coverage for that platform.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-shim-'));
fs.writeFileSync(
  path.join(shimDir, 'fcntl.py'),
  'raise ImportError("simulated non-POSIX platform")\n',
);

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-nolock-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'TASK.md'), '# Active Task\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  return dir;
}

function run(args, cwd, extraEnv = {}) {
  return spawnSync('python3', [tool, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: shimDir, ...extraEnv },
  });
}

const repo = makeRepo();

// mutation refused with remedy
const refused = run(['start', 'Nolock task', '--owner', 'codex'], repo);
assert.notEqual(refused.status, 0, 'start must be refused without locking');
const payload = JSON.parse(refused.stdout);
assert.match(payload.error, /locking is unavailable/);
assert.match(payload.remedy, /AGENT_OPS_UNSAFE_NO_LOCK=1/);

// read-only commands still work
for (const cmd of [['status'], ['check'], ['doctor']]) {
  const result = run(cmd, repo);
  assert.ok(
    result.stdout.trim().startsWith('{'),
    `${cmd[0]} should emit JSON without a lock:\n${result.stderr}`,
  );
}

// override allows the mutation
const overridden = run(['start', 'Nolock task', '--owner', 'codex'], repo, {
  AGENT_OPS_UNSAFE_NO_LOCK: '1',
});
assert.equal(overridden.status, 0, `override should work:\n${overridden.stdout}${overridden.stderr}`);
assert.equal(JSON.parse(overridden.stdout).ok, true);

// sanity: without the shim, locking reports as fcntl in doctor
const native = spawnSync('python3', [tool, 'doctor'], { cwd: repo, encoding: 'utf8' });
assert.match(JSON.parse(native.stdout).runtime.locking, /fcntl/);

console.log('lock refusal tests passed');

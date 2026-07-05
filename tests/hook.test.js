#!/usr/bin/env node
// Pre-commit enforcement hook: install lifecycle, identity resolution, and
// real commits in a fixture repo — blocked when staged files overlap another
// owner's claim, allowed for own claims, bypassable once with the env var.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function makeRepo() {
  // realpath: on macOS mkdtemp returns /var/... while git reports /private/var/...
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ao-hook-')));
  const git = (args, options = {}) =>
    spawnSync('git', args, { cwd: dir, encoding: 'utf8', ...options });
  git(['init', '-q']);
  git(['config', 'user.email', 'test@test']);
  git(['config', 'user.name', 'Test']);
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'TASK.md'), '# Active Task\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  fs.writeFileSync(path.join(dir, '.gitignore'), '.ai/\n');
  fs.copyFileSync(tool, path.join(dir, 'scripts', 'agent-ops-tool.py'));
  git(['add', '-A']);
  git(['commit', '-qm', 'init']);
  return { dir, git };
}

function runTool(dir, args, env = {}) {
  return spawnSync('python3', [path.join(dir, 'scripts', 'agent-ops-tool.py'), ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, AGENT_OPS_OWNER: '', ...env },
  });
}

function ok(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

// --- install lifecycle
{
  const { dir } = makeRepo();
  const dry = ok(runTool(dir, ['hook', 'install', '--dry-run']), 'dry-run');
  assert.equal(JSON.parse(dry.stdout).dry_run, true);
  assert.ok(!fs.existsSync(path.join(dir, '.git', 'hooks', 'pre-commit')), 'dry-run must not write');

  ok(runTool(dir, ['hook', 'install']), 'install');
  const hookPath = path.join(dir, '.git', 'hooks', 'pre-commit');
  assert.ok(fs.existsSync(hookPath));
  assert.ok(fs.statSync(hookPath).mode & 0o100, 'hook must be executable');

  // idempotent
  const again = ok(runTool(dir, ['hook', 'install']), 'reinstall');
  assert.match(JSON.parse(again.stdout).message, /already installed/);

  ok(runTool(dir, ['hook', 'uninstall']), 'uninstall');
  assert.ok(!fs.existsSync(hookPath));

  // refuses to clobber a foreign hook
  fs.writeFileSync(hookPath, '#!/bin/sh\nexit 0\n');
  const clobber = runTool(dir, ['hook', 'install']);
  assert.notEqual(clobber.status, 0);
  assert.match(JSON.parse(clobber.stdout).error, /already exists/);
  const foreignRemove = runTool(dir, ['hook', 'uninstall']);
  assert.notEqual(foreignRemove.status, 0, 'must not remove a hook it did not write');
}

// --- enforcement through real git commits
{
  const { dir, git } = makeRepo();
  ok(runTool(dir, ['hook', 'install']), 'install');
  ok(runTool(dir, ['start', 'Hook task', '--owner', 'codex']), 'start');
  ok(runTool(dir, ['claim', 'src/*', '--owner', 'codex']), 'claim');

  fs.writeFileSync(path.join(dir, 'src', 'main.py'), 'print(1)\n');
  git(['add', 'src/main.py']);

  // different agent → blocked
  const blocked = git(['commit', '-m', 'x'], {
    env: { ...process.env, AGENT_OPS_OWNER: 'claude' },
  });
  assert.notEqual(blocked.status, 0, 'commit by non-owner should be blocked');
  const blockText = blocked.stdout + blocked.stderr;
  assert.match(blockText, /claimed by another agent/);
  assert.match(blockText, /codex/, 'block message must name the owning agent');
  assert.match(blockText, /src\/main\.py/, 'block message must name the file');
  assert.match(blockText, /AGENT_OPS_SKIP_HOOK/, 'block message must offer the bypass');

  // owning agent → allowed
  const allowed = git(['commit', '-qm', 'x'], {
    env: { ...process.env, AGENT_OPS_OWNER: 'codex' },
  });
  assert.equal(allowed.status, 0, `owner commit should pass:\n${allowed.stdout}${allowed.stderr}`);

  // missing identity with claims present → blocked with remediation
  fs.writeFileSync(path.join(dir, 'src', 'other.py'), 'print(2)\n');
  git(['add', 'src/other.py']);
  const noIdentity = git(['commit', '-m', 'x']);
  assert.notEqual(noIdentity.status, 0);
  assert.match(noIdentity.stdout + noIdentity.stderr, /AGENT_OPS_OWNER/);

  // git config fallback works
  git(['config', 'agent-ops.owner', 'codex']);
  const viaConfig = git(['commit', '-qm', 'x']);
  assert.equal(viaConfig.status, 0, `git-config identity should pass:\n${viaConfig.stderr}`);
  git(['config', '--unset', 'agent-ops.owner']);

  // bypass env var
  fs.writeFileSync(path.join(dir, 'src', 'third.py'), 'print(3)\n');
  git(['add', 'src/third.py']);
  const bypassed = git(['commit', '-qm', 'x'], {
    env: { ...process.env, AGENT_OPS_OWNER: 'claude', AGENT_OPS_SKIP_HOOK: '1' },
  });
  assert.equal(bypassed.status, 0, 'bypass should allow the commit');
  assert.match(bypassed.stderr, /bypassed/, 'bypass must be logged');

  // unclaimed files sail through for anyone
  fs.writeFileSync(path.join(dir, 'README.md'), 'hi\n');
  git(['add', 'README.md']);
  const unclaimed = git(['commit', '-qm', 'x'], {
    env: { ...process.env, AGENT_OPS_OWNER: 'claude' },
  });
  assert.equal(unclaimed.status, 0, 'unclaimed file should not be blocked');
}

console.log('hook tests passed');

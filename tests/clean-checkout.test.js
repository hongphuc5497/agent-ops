#!/usr/bin/env node
// Regression test for the ".ai/ core-file trap": agent-ops init gitignores .ai/
// in target repos, so a clean CI checkout has no .ai/ at all. The check must
// tolerate that (skip .ai/ validation) instead of failing with
// "missing required file: .ai/TASK.md". See dogfooding incident in skills#9.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const initScript = path.join(root, 'scripts', 'init-repo.sh');
const checkScript = path.join(root, 'scripts', 'agent-ops-check.sh');

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function assertOk(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  return result;
}

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Reproduce exactly what actions/checkout gives CI in a target repo: init
// agent-ops, commit (the gitignored .ai/ is NOT staged), then extract only the
// tracked tree with `git archive` — no .ai/ directory, no .git.
function cleanCheckoutOfInitedRepo() {
  const repo = mkdtemp('agent-ops-clean-src-');
  assertOk(run('git', ['init', repo]), 'git init');
  assertOk(run('git', ['-C', repo, 'config', 'user.email', 'test@example.com']), 'git config email');
  assertOk(run('git', ['-C', repo, 'config', 'user.name', 'Test']), 'git config name');
  assertOk(run('bash', [initScript, repo]), 'agent-ops init');
  assertOk(run('git', ['-C', repo, 'add', '-A']), 'git add -A');
  assert.equal(
    run('git', ['-C', repo, 'ls-files', '.ai/']).stdout.trim(),
    '',
    'init must gitignore .ai/ (nothing under .ai/ should be staged)'
  );
  assertOk(run('git', ['-C', repo, 'commit', '-m', 'init agent-ops', '--no-verify']), 'git commit');

  const checkout = mkdtemp('agent-ops-clean-ci-');
  execSync(`git -C "${repo}" archive HEAD | tar -x -C "${checkout}"`, { stdio: 'pipe' });
  return checkout;
}

// 1. A clean checkout with NO .ai/ (the default target-repo CI scenario) passes.
function testCleanCheckoutPasses() {
  const checkout = cleanCheckoutOfInitedRepo();
  assert.ok(!fs.existsSync(path.join(checkout, '.ai')), '.ai/ must be absent on clean checkout');

  const result = run('bash', [checkScript], { cwd: checkout });
  assertOk(result, 'agent-ops-check on clean (no .ai/) checkout');
  assert.match(result.stdout, /skipping Agent Ops state checks/);
  assert.match(result.stdout, /agent-ops check passed/);
}

// 2. The relaxation is scoped: once .ai/ IS committed (protocol.md sentinel
//    present), the .ai/ files are validated again — a missing one fails.
function testCommittedAiStillValidated() {
  const checkout = cleanCheckoutOfInitedRepo();
  fs.mkdirSync(path.join(checkout, '.ai'), { recursive: true });
  fs.writeFileSync(path.join(checkout, '.ai', 'protocol.md'), '# protocol\n');

  const result = run('bash', [checkScript], { cwd: checkout });
  assert.notEqual(result.status, 0, 'check must fail when .ai/ is present but incomplete');
  assert.match(result.stderr, /missing required file: \.ai\/TASK\.md/);
}

testCleanCheckoutPasses();
testCommittedAiStillValidated();

console.log('clean-checkout tests passed');

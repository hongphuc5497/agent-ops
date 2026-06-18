#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const cli = path.join(root, 'bin', 'agent-ops.js');
const initScript = path.join(root, 'scripts', 'init-repo.sh');

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

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ops-upgrade-'));
  assertOk(run('git', ['init', dir]), 'git init temp repo');
  return dir;
}

// A repo that was initialized with an older Agent Ops: its copied tool predates
// the kanban commands. We simulate that by replacing the real tool with a stub
// that has no kanban-snapshot, after a normal init seeds everything else.
const OLD_TOOL_STUB = `#!/usr/bin/env python3
import sys

print("old agent-ops-tool: board command not supported", file=sys.stderr)
sys.exit(2)
`;

const CUSTOM_DECISIONS = `# Decisions

## 2026-01-01 — Use Postgres over SQLite
We need concurrent writers, so Postgres it is. This is real project content
that an upgrade must never clobber.
`;

const CUSTOM_TASK = `# Active Task

Status: active
Owner: Codex
Started: 2026-01-02T10:00:00+00:00
Task file: .ai/tasks/some-real-task.md

## Current Objective

Ship the real feature this project is actually working on.
`;

function toolHasKanban(repo) {
  const tool = fs.readFileSync(
    path.join(repo, 'scripts', 'agent-ops-tool.py'),
    'utf8'
  );
  return tool.includes('command_kanban_snapshot');
}

// --- 1. Upgrade refreshes the tool, preserves customized generated files ----
function testUpgradePreservesContentAndRefreshesTool() {
  const repo = makeRepo();

  // Old install: full init, then downgrade the tool and customize project files.
  assertOk(run('bash', [initScript, repo]), 'init old repo');
  assert.equal(toolHasKanban(repo), true, 'real init seeds the kanban tool');

  fs.writeFileSync(path.join(repo, 'scripts', 'agent-ops-tool.py'), OLD_TOOL_STUB);
  fs.writeFileSync(path.join(repo, 'DECISIONS.md'), CUSTOM_DECISIONS);
  fs.writeFileSync(path.join(repo, 'TASK.md'), CUSTOM_TASK);
  assert.equal(toolHasKanban(repo), false, 'stub tool lacks kanban-snapshot');

  // Old tool cannot serve the board.
  const before = run('python3', [
    path.join(repo, 'scripts', 'agent-ops-tool.py'),
    'kanban-snapshot',
  ]);
  assert.notEqual(before.status, 0, 'old tool fails kanban-snapshot');

  // Upgrade via the CLI command (exercises bin/agent-ops.js + init-repo.sh).
  const upgrade = run(node, [cli, 'upgrade', repo], { cwd: root });
  assertOk(upgrade, 'agent-ops upgrade');
  assert.match(upgrade.stdout, /Agent Ops upgraded in /);
  assert.match(upgrade.stdout, /preserved DECISIONS\.md/);
  assert.match(upgrade.stdout, /preserved TASK\.md/);

  // Tool regained the kanban commands.
  assert.equal(toolHasKanban(repo), true, 'upgrade re-copies the current tool');
  const after = run('python3', [
    path.join(repo, 'scripts', 'agent-ops-tool.py'),
    'kanban-snapshot',
  ]);
  assertOk(after, 'upgraded tool runs kanban-snapshot');
  assert.equal(JSON.parse(after.stdout).ok, true);

  // Customized project content survived untouched.
  assert.equal(
    fs.readFileSync(path.join(repo, 'DECISIONS.md'), 'utf8'),
    CUSTOM_DECISIONS,
    'DECISIONS.md preserved'
  );
  assert.equal(
    fs.readFileSync(path.join(repo, 'TASK.md'), 'utf8'),
    CUSTOM_TASK,
    'TASK.md preserved'
  );

  // The upgraded repo passes its own health check.
  const check = run('bash', [path.join(repo, 'scripts', 'agent-ops-check.sh')], {
    cwd: repo,
  });
  assertOk(check, 'agent-ops-check.sh on upgraded repo');
  assert.match(check.stdout, /agent-ops check passed/);
}

// --- 2. Dry-run upgrade reports the plan without touching anything ----------
function testUpgradeDryRunIsReadOnly() {
  const repo = makeRepo();
  assertOk(run('bash', [initScript, repo]), 'init repo for dry-run');
  fs.writeFileSync(path.join(repo, 'DECISIONS.md'), CUSTOM_DECISIONS);

  const result = run('bash', [initScript, repo, '--upgrade', '--dry-run']);
  assertOk(result, 'upgrade --dry-run');
  assert.match(result.stdout, /would copy scripts\/agent-ops-tool\.py/);
  assert.match(result.stdout, /would preserve DECISIONS\.md/);
  assert.match(result.stdout, /Agent Ops upgraded in /);

  // Nothing was written.
  assert.equal(
    fs.readFileSync(path.join(repo, 'DECISIONS.md'), 'utf8'),
    CUSTOM_DECISIONS,
    'dry-run did not rewrite DECISIONS.md'
  );
}

// --- 3. Upgrade refuses a repo that was never initialized -------------------
function testUpgradeRefusesUninitializedRepo() {
  const repo = makeRepo();
  const result = run('bash', [initScript, repo, '--upgrade']);
  assert.notEqual(result.status, 0, 'upgrade on bare repo should fail');
  assert.match(result.stderr, /no existing Agent Ops install found/);
  assert.match(result.stderr, /run 'agent-ops init' first/);
}

// --- 4. Upgrade seeds a generated file that is missing ----------------------
function testUpgradeSeedsMissingGeneratedFile() {
  const repo = makeRepo();
  assertOk(run('bash', [initScript, repo]), 'init repo for missing-file case');

  // Simulate a generated file lost on a fresh clone (.ai/ is gitignored).
  fs.rmSync(path.join(repo, '.ai', 'state', 'file-claims.json'));

  const result = assertOk(
    run('bash', [initScript, repo, '--upgrade']),
    'upgrade seeds missing generated file'
  );
  assert.match(result.stdout, /wrote \.ai\/state\/file-claims\.json/);
  assert.ok(
    fs.existsSync(path.join(repo, '.ai', 'state', 'file-claims.json')),
    'missing generated file was recreated'
  );
}

// --- 5. The CLI advertises the upgrade command ------------------------------
function testCliHelpMentionsUpgrade() {
  const result = assertOk(run(node, [cli, '--help']), 'agent-ops --help');
  assert.match(result.stdout, /agent-ops upgrade \[target\]/);
}

testUpgradePreservesContentAndRefreshesTool();
testUpgradeDryRunIsReadOnly();
testUpgradeRefusesUninitializedRepo();
testUpgradeSeedsMissingGeneratedFile();
testCliHelpMentionsUpgrade();

console.log('upgrade tests passed');

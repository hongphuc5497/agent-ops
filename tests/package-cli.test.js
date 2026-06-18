#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const cli = path.join(root, 'bin', 'agent-ops.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
  return result;
}

function assertOk(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function testPackageMetadata() {
  const pkg = readPackageJson();
  assert.equal(pkg.name, '@hongphuc5497/agent-ops');
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(pkg.bin['agent-ops'], 'bin/agent-ops.js');
  assert.equal(pkg.bin.ao, 'bin/agent-ops.js');
  assert.ok(pkg.files.includes('bin/agent-ops.js'));
  assert.ok(pkg.files.includes('scripts/ao'));
  assert.ok(pkg.files.includes('integrations/'));
  assert.ok(pkg.files.includes('.ai/protocol.md'));
  assert.ok(pkg.files.includes('.ai/schema/'));
  assert.ok(pkg.files.includes('.ai/templates/'));
  assert.ok(pkg.files.includes('.ai/workflows/'));
  assert.ok(pkg.files.includes('docs/'));
}

function testCliHelpMentionsInstallStyleInit() {
  const result = run(node, [cli, '--help']);
  assertOk(result, 'agent-ops --help');
  assert.match(result.stdout, /agent-ops init \[target\]/);
  assert.match(result.stdout, /agent-ops install <integration>/);
  assert.match(result.stdout, /agent-ops kanban/);
  assert.match(result.stdout, /agent-ops status/);
}

function testCliCanDryRunInitFromPackageRoot() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ops-package-test-'));
  assertOk(run('git', ['init', target]), 'git init temp repo');

  const result = run(node, [cli, 'init', target, '--dry-run']);
  assertOk(result, 'agent-ops init dry-run');
  assert.match(result.stdout, /would copy docs\/supported-integrations\.md/);
  assert.match(result.stdout, /Agent Ops initialized in /);
}

function testCliDelegatesRepoLocalStatus() {
  const result = run(node, [cli, 'status']);
  assertOk(result, 'agent-ops status');
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.active, 'boolean');
}

function testPackContainsProtocolFiles() {
  const result = run('npm', ['pack', '--json', '--dry-run']);
  assertOk(result, 'npm pack --dry-run');
  const [pack] = JSON.parse(result.stdout);
  const files = new Set(pack.files.map((file) => file.path));
  for (const required of [
    'bin/agent-ops.js',
    'bin/kanban-server.js',
    'scripts/ao',
    'scripts/init-repo.sh',
    'scripts/install-integration.sh',
    'integrations/codex/AGENTS.template.md',
    'docs/supported-integrations.md',
    'web/kanban/index.html',
    'web/kanban/styles.css',
    'web/kanban/app.js',
    '.ai/protocol.md',
    '.ai/schema/task.schema.json',
    '.github/workflows/agent-ops-check.yml',
  ]) {
    assert.ok(files.has(required), `npm pack missing ${required}`);
  }
  for (const excluded of [
    '.ai/state/active-task.json',
    '.ai/state/file-claims.json',
    '.ai/tasks/20260616-111431-make-agent-ops-installable-like-ai-devkit.md',
    'scripts/__pycache__/agent-ops-tool.cpython-311.pyc',
  ]) {
    assert.equal(files.has(excluded), false, `npm pack should not include ${excluded}`);
  }
}

testPackageMetadata();
testCliHelpMentionsInstallStyleInit();
testCliCanDryRunInitFromPackageRoot();
testCliDelegatesRepoLocalStatus();
testPackContainsProtocolFiles();

console.log('package CLI tests passed');

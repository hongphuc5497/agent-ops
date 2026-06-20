#!/usr/bin/env node
// `agent-ops tutorial` seeds a guided demo task so new users learn the
// coordination loop without touching real code. Tests cover the happy
// path, refusal when an active task already exists, and the contract that
// the task markdown matches the bundled tutorial content.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const cli = path.join(root, 'bin', 'agent-ops.js');
const initScript = path.join(root, 'scripts', 'init-repo.sh');
const tutorialSource = path.join(root, '.ai', 'integrations', 'templates', 'tutorial', 'first-task.md');

function makeInitializedRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tutorial-'));
  const initResult = spawnSync('git', ['init', dir], { encoding: 'utf8' });
  assert.equal(initResult.status, 0, 'git init');
  const init = spawnSync('bash', [initScript, dir], { encoding: 'utf8' });
  assert.equal(init.status, 0, `init-repo.sh: ${init.stderr}`);
  return dir;
}

function run(args, cwd) {
  return spawnSync(node, [cli, ...args], { cwd, encoding: 'utf8' });
}

function testTutorialBundleExists() {
  assert.ok(fs.existsSync(tutorialSource), `tutorial source missing at ${tutorialSource}`);
  const content = fs.readFileSync(tutorialSource, 'utf8');
  assert.match(content, /Agent Ops Tutorial/);
  assert.match(content, /agent-ops claim/);
  assert.match(content, /agent-ops finish/);
}

function testTutorialCreatesActiveTask() {
  const repo = makeInitializedRepo();
  const result = run(['tutorial'], repo);
  assert.equal(
    result.status,
    0,
    `tutorial command failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /Tutorial task created/);

  // The active task should now be the tutorial.
  const tool = path.join(repo, 'scripts', 'agent-ops-tool.py');
  const status = spawnSync('python3', [tool, 'status'], { cwd: repo, encoding: 'utf8' });
  assert.equal(status.status, 0);
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.active, true);
  assert.equal(payload.task.title, 'Agent Ops Tutorial');
  assert.equal(payload.task.owner, 'you');

  // And the task markdown should match the bundled tutorial content.
  const taskFile = path.join(repo, payload.task.task_file);
  assert.ok(fs.existsSync(taskFile), 'tutorial task file written');
  const written = fs.readFileSync(taskFile, 'utf8');
  const expected = fs.readFileSync(tutorialSource, 'utf8');
  assert.equal(written, expected, 'tutorial markdown matches bundled content');
}

function testTutorialRefusesWhenActiveTaskExists() {
  const repo = makeInitializedRepo();
  const tool = path.join(repo, 'scripts', 'agent-ops-tool.py');
  // Seed an unrelated active task so the tutorial would clobber it.
  const start = spawnSync(
    'python3',
    [tool, 'start', 'Real work', '--owner', 'Codex'],
    { cwd: repo, encoding: 'utf8' },
  );
  assert.equal(start.status, 0);

  const result = run(['tutorial'], repo);
  assert.notEqual(result.status, 0, 'tutorial must refuse to clobber active task');
  assert.match(result.stderr, /active task already exists/i);

  // The real task survives.
  const status = spawnSync('python3', [tool, 'status'], { cwd: repo, encoding: 'utf8' });
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.task.title, 'Real work');
}

function testTutorialRefusesOnUninitializedRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-tutorial-bare-'));
  const result = run(['tutorial'], dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not initialized/i);
}

testTutorialBundleExists();
testTutorialCreatesActiveTask();
testTutorialRefusesWhenActiveTaskExists();
testTutorialRefusesOnUninitializedRepo();
console.log('tutorial tests passed');

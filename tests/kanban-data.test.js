#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function ok(result, label) {
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-kanban-data-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'TASK.md'), '# Active Task\n\nStatus: none\n');
  fs.writeFileSync(path.join(dir, '.ai/state/file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai/state/handoffs.jsonl'), '');
  return dir;
}

const repo = makeRepo();
ok(run('python3', [tool, 'create-task', 'Backlog task', '--owner', 'Codex'], repo), 'create backlog');
ok(run('python3', [tool, 'start', 'Active task', '--owner', 'Codex'], repo), 'start active');
ok(run('python3', [tool, 'finish', 'done', '--verification', 'node test'], repo), 'finish active');

const snapshot = ok(run('python3', [tool, 'kanban-snapshot'], repo), 'snapshot');
const data = JSON.parse(snapshot.stdout);

assert.equal(data.ok, true);
assert.equal(data.columns.backlog.length, 1);
assert.equal(data.columns.done.length, 1);
assert.equal(data.columns.backlog[0].title, 'Backlog task');
assert.equal(data.columns.done[0].title, 'Active task');
assert.ok(Array.isArray(data.claims));
assert.ok(Array.isArray(data.handoffs));

const update = ok(
  run('python3', [tool, 'update-task', data.columns.backlog[0].id, '--title', 'Updated backlog', '--verification', 'npm test'], repo),
  'update backlog'
);
const updatePayload = JSON.parse(update.stdout);
assert.equal(updatePayload.ok, true);

const afterUpdate = JSON.parse(ok(run('python3', [tool, 'kanban-snapshot'], repo), 'snapshot after update').stdout);
assert.equal(afterUpdate.columns.backlog[0].title, 'Updated backlog');
assert.equal(afterUpdate.columns.backlog[0].verification, 'npm test');

console.log('kanban data tests passed');

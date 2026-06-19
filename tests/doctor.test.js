#!/usr/bin/env node
// `agent-ops doctor` must return structured diagnostics: tool version,
// runtime versions, locking strategy, and any state validation problems.
// This is the first thing a user runs when filing a bug report — the
// shape and presence of fields is the contract.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');
const ao = path.join(root, 'scripts', 'ao');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-doctor-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  return dir;
}

function run(args, cwd) {
  return spawnSync('python3', [tool, ...args], { cwd, encoding: 'utf8' });
}

function testDoctorReturnsExpectedShape() {
  const repo = makeRepo();
  const result = run(['doctor'], repo);
  // doctor can exit non-zero if optional files are missing — that's expected
  // on a bare repo. We only care that the structured payload is sane.
  const payload = JSON.parse(result.stdout);

  assert.equal(typeof payload.ok, 'boolean');
  assert.ok(payload.agent_ops, 'agent_ops section');
  assert.equal(payload.agent_ops.tool_version, '0.2.0');
  assert.equal(typeof payload.agent_ops.repo_initialized, 'boolean');
  assert.equal(typeof payload.agent_ops.repo_root, 'string');

  assert.ok(payload.runtime, 'runtime section');
  assert.match(payload.runtime.python, /^\d+\.\d+/);
  assert.ok(['fcntl', 'atomic-write-only'].includes(payload.runtime.locking));
  assert.equal(typeof payload.runtime.platform, 'string');

  assert.ok(payload.health, 'health section');
  assert.ok(Array.isArray(payload.health.missing));
  assert.ok(payload.state_problems, 'state_problems section');
}

function testDoctorSurfacesCorruptHandoffLines() {
  const repo = makeRepo();
  // Append a malformed JSONL line. Doctor should report which line and why
  // without crashing — bug reports get specific instead of vague.
  fs.appendFileSync(path.join(repo, '.ai', 'state', 'handoffs.jsonl'), 'not json\n');
  const result = run(['doctor'], repo);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.ok(
    Array.isArray(payload.state_problems['handoffs.jsonl']),
    'handoff problems listed',
  );
  assert.match(payload.state_problems['handoffs.jsonl'][0], /line 1/);
}

function testAoWrapperRoutesDoctor() {
  const repo = makeRepo();
  const result = spawnSync('bash', [ao, 'doctor'], { cwd: repo, encoding: 'utf8' });
  // status may be 0 or 1 depending on missing files; just confirm the
  // command was recognized and produced valid JSON.
  assert.ok(result.stdout.startsWith('{'), `ao doctor stdout: ${result.stdout}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.agent_ops.tool_version, '0.2.0');
}

testDoctorReturnsExpectedShape();
testDoctorSurfacesCorruptHandoffLines();
testAoWrapperRoutesDoctor();
console.log('doctor tests passed');

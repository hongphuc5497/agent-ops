#!/usr/bin/env node
// `agent-ops init --interactive` prompts for which agents to install and
// whether to seed a tutorial, then chains init + install + tutorial in
// one shot. We drive the prompts via stdin and assert the end state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const node = process.execPath;
const cli = path.join(root, 'bin', 'agent-ops.js');

function makeBareRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-interactive-'));
  spawnSync('git', ['init', dir], { stdio: 'ignore' });
  return dir;
}

function runInteractive(args, stdinLines) {
  return new Promise((resolve) => {
    const child = spawn(node, [cli, ...args], { encoding: 'utf8' });
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
    // Feed answers in order — readline reads one line per question.
    child.stdin.write(stdinLines.map((line) => `${line}\n`).join(''));
    child.stdin.end();
  });
}

async function testInteractiveInitInstallsChosenAgents() {
  const repo = makeBareRepo();
  const result = await runInteractive(
    ['init', repo, '--interactive'],
    ['claude,codex', 'Y'],
  );
  assert.equal(
    result.status,
    0,
    `interactive init failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /Agent Ops setup complete/);

  // Both chosen agents got installed.
  const agentsMd = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
  assert.match(agentsMd, /Agent Ops Rules for Codex/);
  const claudeMd = fs.readFileSync(path.join(repo, 'CLAUDE.md'), 'utf8');
  assert.match(claudeMd, /Agent Ops Rules for Claude/);

  // Tutorial was seeded because the user said Y.
  const status = spawnSync(
    'python3',
    [path.join(repo, 'scripts', 'agent-ops-tool.py'), 'status'],
    { cwd: repo, encoding: 'utf8' },
  );
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.active, true);
  assert.equal(payload.task.title, 'Agent Ops Tutorial');
}

async function testInteractiveInitWithoutTutorial() {
  const repo = makeBareRepo();
  const result = await runInteractive(
    ['init', repo, '--interactive'],
    ['claude', 'n'],
  );
  assert.equal(result.status, 0);

  // No active task.
  const status = spawnSync(
    'python3',
    [path.join(repo, 'scripts', 'agent-ops-tool.py'), 'status'],
    { cwd: repo, encoding: 'utf8' },
  );
  const payload = JSON.parse(status.stdout);
  assert.equal(payload.active, false);

  // Codex was NOT chosen, so AGENTS.md should not exist or should not contain the rules.
  const agentsPath = path.join(repo, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const agentsMd = fs.readFileSync(agentsPath, 'utf8');
    assert.equal(agentsMd.includes('Agent Ops Rules for Codex'), false, 'codex not installed');
  }
}

async function testInteractiveInitRejectsUnknownAgent() {
  const repo = makeBareRepo();
  const result = await runInteractive(
    ['init', repo, '--interactive'],
    ['claude,fakebot', 'Y'],
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown agent.*fakebot/i);
}

(async () => {
  await testInteractiveInitInstallsChosenAgents();
  await testInteractiveInitWithoutTutorial();
  await testInteractiveInitRejectsUnknownAgent();
  console.log('interactive init tests passed');
})();

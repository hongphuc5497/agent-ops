#!/usr/bin/env node
// ensure_gitignore must recognize an existing .ai/ ignore in BOTH forms:
// the blanket `.ai/` (default) and the allowlist anchor `.ai/*` (used by repos
// that commit some .ai/ source). Regression: it appended a redundant blanket
// `.ai/` after an allowlist, re-ignoring the allowlisted files (seen live when
// upgrading personal-landing-page).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
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

function makeRepo(gitignore) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-ops-gitignore-'));
  assertOk(run('git', ['init', repo]), 'git init');
  if (gitignore != null) fs.writeFileSync(path.join(repo, '.gitignore'), gitignore);
  return repo;
}

function readGitignore(repo) {
  return fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');
}

function countBlanketAi(text) {
  return text.split('\n').filter((line) => line.trim() === '.ai/').length;
}

// Allowlist style: repo commits .ai/ source while ignoring runtime. init must
// NOT append a blanket `.ai/` that would re-ignore the allowlisted files.
function testAllowlistNotClobbered() {
  const allowlist = [
    'node_modules/',
    '.ai/*',
    '!.ai/protocol.md',
    '!.ai/ROUTING.md',
    '!.ai/integrations/',
    '.ai/integrations/*',
    '!.ai/integrations/templates/',
    '',
  ].join('\n');
  const repo = makeRepo(allowlist);
  const result = assertOk(run('bash', [initScript, repo]), 'init over allowlist .gitignore');
  assert.match(result.stdout, /\.gitignore already ignores \.ai\//);

  const text = readGitignore(repo);
  assert.equal(countBlanketAi(text), 0, 'must not append a blanket .ai/ over an allowlist');
  assert.match(text, /^\.ai\/\*$/m, 'allowlist anchor .ai/* preserved');
  assert.match(text, /^!\.ai\/integrations\/templates\/$/m, 'allowlist un-ignore rules preserved');
}

// Bare `.ai/` already present → recognized, not duplicated.
function testBareNotDuplicated() {
  const repo = makeRepo('node_modules/\n.ai/\n');
  const result = assertOk(run('bash', [initScript, repo]), 'init over bare .ai/');
  assert.match(result.stdout, /already ignores \.ai\//);
  assert.equal(countBlanketAi(readGitignore(repo)), 1, 'bare .ai/ must not be duplicated');
}

// No .ai/ rule at all → blanket `.ai/` appended exactly once (default behavior).
function testAppendsWhenMissing() {
  const repo = makeRepo('node_modules/\n');
  const result = assertOk(run('bash', [initScript, repo]), 'init over .gitignore without .ai/');
  assert.match(result.stdout, /updated \.gitignore: ignore \.ai\//);
  assert.equal(countBlanketAi(readGitignore(repo)), 1, 'blanket .ai/ appended once');
}

testAllowlistNotClobbered();
testBareNotDuplicated();
testAppendsWhenMissing();

console.log('gitignore tests passed');

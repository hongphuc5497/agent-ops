#!/usr/bin/env node
// The release workflow extracts notes from CHANGELOG.md by version. If
// this extractor is wrong, every GitHub release gets the wrong body —
// so the contract is tested here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const extractor = path.join(root, 'scripts', 'extract-changelog.sh');

function run(version, cwd) {
  return spawnSync('bash', [extractor, version], { cwd, encoding: 'utf8' });
}

function makeChangelog(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-changelog-'));
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), content);
  return dir;
}

function testExtractsOnlyTheRequestedSection() {
  const dir = makeChangelog(
    [
      '# Changelog',
      '',
      '## 0.3.0 — 2026-06-20',
      '',
      'M2 stuff.',
      '',
      '## 0.2.0 — 2026-06-19',
      '',
      'M1 stuff.',
      '',
      '## 0.1.0 — 2026-06-18',
      '',
      'Initial.',
      '',
    ].join('\n'),
  );
  const result = run('0.2.0', dir);
  assert.equal(result.status, 0, `extractor failed: ${result.stderr}`);
  assert.match(result.stdout, /M1 stuff/);
  assert.equal(result.stdout.includes('M2 stuff'), false, 'must not bleed into next');
  assert.equal(result.stdout.includes('Initial'), false, 'must not bleed into previous');
}

function testHandlesTitleWithEmDashAfterVersion() {
  const dir = makeChangelog('## 0.3.0 — Onboarding velocity\n\nNotes here.\n');
  const result = run('0.3.0', dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Notes here/);
}

function testEmptyOutputWhenVersionMissing() {
  const dir = makeChangelog('## 0.3.0\n\nFoo.\n');
  const result = run('9.9.9', dir);
  assert.equal(result.status, 0, 'missing version must exit 0 (soft warning)');
  assert.equal(result.stdout.trim(), '');
}

function testFailsWhenChangelogAbsent() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-changelog-empty-'));
  const result = run('0.3.0', dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not found/);
}

function testRequiresVersionArgument() {
  const dir = makeChangelog('');
  const result = spawnSync('bash', [extractor], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage:/);
}

testExtractsOnlyTheRequestedSection();
testHandlesTitleWithEmDashAfterVersion();
testEmptyOutputWhenVersionMissing();
testFailsWhenChangelogAbsent();
testRequiresVersionArgument();
console.log('extract-changelog tests passed');

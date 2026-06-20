#!/usr/bin/env node
// v0.5.0 migration: TASK.md, ROUTING.md, DECISIONS.md moved from the repo
// root into .ai/. The upgrade command auto-migrates existing v0.4.x repos.
// These tests prove the migration:
//   1. Old-layout repo (files at root) → upgrade → files at .ai/, content
//      preserved verbatim, root copies gone
//   2. Re-running upgrade is a safe no-op (the migration block is guarded
//      on "exists at root && not at .ai/")
//   3. doctor surfaces legacy_layout problems with a remedy when run on
//      a repo that still has root files
//   4. New init produces the .ai/ layout from the start
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const initScript = path.join(root, 'scripts', 'init-repo.sh');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

function ok(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-migrate-'));
  ok(run('git', ['init', dir]), 'git init');
  return dir;
}

// Simulate a repo that was initialized under v0.4.x: full init succeeds,
// then we manually move the files back to the root so the next upgrade
// sees the "old" layout. Done this way (rather than checking in fixtures)
// because the actual file contents depend on the current build.
function simulateLegacyLayout(repo, taskContent, decisionsContent, routingContent) {
  ok(run('bash', [initScript, repo]), 'init');
  fs.renameSync(path.join(repo, '.ai/TASK.md'), path.join(repo, 'TASK.md'));
  fs.renameSync(path.join(repo, '.ai/DECISIONS.md'), path.join(repo, 'DECISIONS.md'));
  fs.renameSync(path.join(repo, '.ai/ROUTING.md'), path.join(repo, 'ROUTING.md'));
  // v0.5.0 also moves integrations/ from the repo root into .ai/integrations/templates/.
  // Simulate that legacy layout too — move the templates dir back to the root.
  fs.renameSync(
    path.join(repo, '.ai/integrations/templates'),
    path.join(repo, 'integrations'),
  );
  if (taskContent !== undefined) fs.writeFileSync(path.join(repo, 'TASK.md'), taskContent);
  if (decisionsContent !== undefined) fs.writeFileSync(path.join(repo, 'DECISIONS.md'), decisionsContent);
  if (routingContent !== undefined) fs.writeFileSync(path.join(repo, 'ROUTING.md'), routingContent);
}

function testUpgradeMigratesAndPreservesContent() {
  const repo = makeRepo();
  const CUSTOM_TASK = '# Active Task\n\nStatus: active\nOwner: Codex\nReal user content.\n';
  const CUSTOM_DEC = '# Decisions\n\n## 2026-01-01 — Use Postgres\nReal user ADR.\n';
  // ROUTING.md is reference content (in copy_files) — upgrade refreshes it from
  // the package. The migration only matters for moving the FILE; the content
  // contract is "refreshed". TASK.md and DECISIONS.md are user data
  // (generated_files) and are preserved verbatim.
  simulateLegacyLayout(repo, CUSTOM_TASK, CUSTOM_DEC);

  assert.ok(fs.existsSync(path.join(repo, 'TASK.md')), 'TASK.md at root before upgrade');
  assert.ok(!fs.existsSync(path.join(repo, '.ai/TASK.md')), 'no .ai/TASK.md yet');

  const upgrade = ok(run('bash', [initScript, repo, '--upgrade']), 'upgrade');
  assert.match(upgrade.stdout, /migrated TASK\.md to \.ai\/TASK\.md/);
  assert.match(upgrade.stdout, /migrated ROUTING\.md to \.ai\/ROUTING\.md/);
  assert.match(upgrade.stdout, /migrated DECISIONS\.md to \.ai\/DECISIONS\.md/);
  assert.match(upgrade.stdout, /migrated integrations\/ to \.ai\/integrations\/templates\//);

  // Old root paths are gone.
  assert.ok(!fs.existsSync(path.join(repo, 'TASK.md')), 'root TASK.md gone');
  assert.ok(!fs.existsSync(path.join(repo, 'ROUTING.md')), 'root ROUTING.md gone');
  assert.ok(!fs.existsSync(path.join(repo, 'DECISIONS.md')), 'root DECISIONS.md gone');
  assert.ok(!fs.existsSync(path.join(repo, 'integrations')), 'root integrations/ gone');
  // New paths exist.
  assert.ok(fs.existsSync(path.join(repo, '.ai/TASK.md')), '.ai/TASK.md present');
  assert.ok(fs.existsSync(path.join(repo, '.ai/ROUTING.md')), '.ai/ROUTING.md present');
  assert.ok(fs.existsSync(path.join(repo, '.ai/DECISIONS.md')), '.ai/DECISIONS.md present');
  assert.ok(
    fs.existsSync(path.join(repo, '.ai/integrations/templates/codex/AGENTS.template.md')),
    '.ai/integrations/templates/ present with content',
  );

  // User-data content preserved verbatim across the migration + refresh.
  assert.equal(
    fs.readFileSync(path.join(repo, '.ai/TASK.md'), 'utf8'),
    CUSTOM_TASK,
    'TASK.md content preserved',
  );
  assert.equal(
    fs.readFileSync(path.join(repo, '.ai/DECISIONS.md'), 'utf8'),
    CUSTOM_DEC,
    'DECISIONS.md content preserved',
  );
}

function testRerunningUpgradeIsNoOp() {
  const repo = makeRepo();
  simulateLegacyLayout(repo, '# old TASK\n', '# old DEC\n');
  ok(run('bash', [initScript, repo, '--upgrade']), 'first upgrade migrates');

  // Second upgrade should NOT re-print migrated lines because nothing is at root anymore.
  const second = ok(run('bash', [initScript, repo, '--upgrade']), 'second upgrade');
  assert.equal(
    second.stdout.includes('migrated TASK.md'),
    false,
    'second upgrade must not re-migrate',
  );
}

function testDoctorFlagsLegacyLayout() {
  const repo = makeRepo();
  simulateLegacyLayout(repo, '# x\n', '# y\n');

  const result = run('python3', [tool, 'doctor'], { cwd: repo });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false, 'doctor must flag legacy layout as not-ok');
  assert.deepEqual(
    payload.legacy_layout.files_at_root.sort(),
    ['DECISIONS.md', 'ROUTING.md', 'TASK.md', 'integrations/'],
    'all four legacy paths listed',
  );
  assert.match(payload.legacy_layout.remedy, /agent-ops upgrade/);
}

function testFreshInitProducesAiLayout() {
  const repo = makeRepo();
  ok(run('bash', [initScript, repo]), 'init');
  assert.ok(fs.existsSync(path.join(repo, '.ai/TASK.md')), '.ai/TASK.md');
  assert.ok(fs.existsSync(path.join(repo, '.ai/ROUTING.md')), '.ai/ROUTING.md');
  assert.ok(fs.existsSync(path.join(repo, '.ai/DECISIONS.md')), '.ai/DECISIONS.md');
  assert.ok(
    fs.existsSync(path.join(repo, '.ai/integrations/templates/codex/AGENTS.template.md')),
    '.ai/integrations/templates/codex/AGENTS.template.md from fresh init',
  );
  assert.ok(!fs.existsSync(path.join(repo, 'TASK.md')), 'no root TASK.md');
  assert.ok(!fs.existsSync(path.join(repo, 'ROUTING.md')), 'no root ROUTING.md');
  assert.ok(!fs.existsSync(path.join(repo, 'DECISIONS.md')), 'no root DECISIONS.md');
  assert.ok(!fs.existsSync(path.join(repo, 'integrations')), 'no root integrations/');
}

function testDryRunMigrationDoesNotMove() {
  const repo = makeRepo();
  simulateLegacyLayout(repo, '# t\n', '# d\n');

  const result = ok(
    run('bash', [initScript, repo, '--upgrade', '--dry-run']),
    'dry-run upgrade',
  );
  assert.match(result.stdout, /would move TASK\.md to \.ai\/TASK\.md/);
  assert.match(result.stdout, /would move integrations\/ to \.ai\/integrations\/templates\//);
  // Files NOT moved by dry-run.
  assert.ok(fs.existsSync(path.join(repo, 'TASK.md')), 'root TASK.md still there after dry-run');
  assert.ok(fs.existsSync(path.join(repo, 'integrations')), 'root integrations/ still there after dry-run');
  assert.ok(!fs.existsSync(path.join(repo, '.ai/TASK.md')), 'no .ai/TASK.md from dry-run');
  assert.ok(
    !fs.existsSync(path.join(repo, '.ai/integrations/templates')),
    'no .ai/integrations/templates/ from dry-run',
  );
}

testUpgradeMigratesAndPreservesContent();
testRerunningUpgradeIsNoOp();
testDoctorFlagsLegacyLayout();
testFreshInitProducesAiLayout();
testDryRunMigrationDoesNotMove();
console.log('migrate tests passed');

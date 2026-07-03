#!/usr/bin/env node
// Glob-aware claim conflicts: a claim on `tests/*` must conflict with a later
// claim on `tests/foo.test.js` by another owner (and vice versa), including
// directory-prefix claims like `tests` or `tests/`. Exact-string matching
// alone would let two agents edit the same files under different spellings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-overlap-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'TASK.md'), '# Active Task\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  return dir;
}

function run(args, cwd) {
  return spawnSync('python3', [tool, ...args], { cwd, encoding: 'utf8' });
}

function ok(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function expectConflict(result, label) {
  assert.notEqual(result.status, 0, `${label}: expected conflict, got success\n${result.stdout}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false, label);
  assert.match(payload.error, /claim conflict/, label);
}

function freshRepoWithClaim(claimPath) {
  const repo = makeRepo();
  ok(run(['start', 'Overlap task', '--owner', 'Codex'], repo), 'start');
  ok(run(['claim', claimPath, '--owner', 'Codex'], repo), `claim ${claimPath}`);
  return repo;
}

// Glob claim blocks a literal path underneath it.
{
  const repo = freshRepoWithClaim('tests/*');
  expectConflict(
    run(['claim', 'tests/foo.test.js', '--owner', 'agent2'], repo),
    'glob vs literal',
  );
}

// Literal claim blocks a later glob that covers it.
{
  const repo = freshRepoWithClaim('tests/foo.test.js');
  expectConflict(
    run(['claim', 'tests/*', '--owner', 'agent2'], repo),
    'literal vs glob',
  );
}

// Directory claim (no glob, no trailing slash) blocks files under it.
{
  const repo = freshRepoWithClaim('tests');
  expectConflict(
    run(['claim', 'tests/deep/nested.js', '--owner', 'agent2'], repo),
    'directory vs nested file',
  );
}

// Trailing-slash and ./ spellings normalize to the same claim.
{
  const repo = freshRepoWithClaim('tests/');
  expectConflict(
    run(['claim', './tests/foo.js', '--owner', 'agent2'], repo),
    'trailing slash vs ./ prefix',
  );
}

// Disjoint paths still coexist.
{
  const repo = freshRepoWithClaim('tests/*');
  ok(
    run(['claim', 'src/main.py', '--owner', 'agent2'], repo),
    'disjoint claim should succeed',
  );
}

// Dotted directories are not mangled by normalization: a claim on .github
// must not conflict with a claim on github.
{
  const repo = freshRepoWithClaim('.github/workflows/ci.yml');
  ok(
    run(['claim', 'github.md', '--owner', 'agent2'], repo),
    'dotfile normalization should not strip leading dot',
  );
}

// Glob-vs-glob with prefix-compatible literal stems must conflict:
// `web/kanban/*.js` and `web/kanban/app.*` both cover web/kanban/app.js.
{
  const repo = freshRepoWithClaim('web/kanban/*.js');
  expectConflict(
    run(['claim', 'web/kanban/app.*', '--owner', 'agent2'], repo),
    'glob vs glob with shared prefix',
  );
}

// Glob-vs-glob with divergent literal stems stays disjoint.
{
  const repo = freshRepoWithClaim('src/a*');
  ok(
    run(['claim', 'src/b*', '--owner', 'agent2'], repo),
    'disjoint globs should coexist',
  );
}

// Filesystem-equivalent spellings normalize to the same claim:
// `src/./foo.ts` and `lib/../src/foo.ts` are both src/foo.ts.
{
  const repo = freshRepoWithClaim('src/foo.ts');
  expectConflict(
    run(['claim', 'src/./foo.ts', '--owner', 'agent2'], repo),
    'dot-segment spelling',
  );
  expectConflict(
    run(['claim', 'lib/../src/foo.ts', '--owner', 'agent2'], repo),
    'parent-segment spelling',
  );
}

// A claim on `.` covers the whole repo.
{
  const repo = freshRepoWithClaim('.');
  expectConflict(
    run(['claim', 'src/anything.ts', '--owner', 'agent2'], repo),
    'dot claims everything',
  );
}

// Bracket dirs (Next.js dynamic routes) must not slip through: a glob under
// `app/[id]/` conflicts with a literal file under the same directory.
{
  const repo = freshRepoWithClaim('app/[id]/*');
  expectConflict(
    run(['claim', 'app/[id]/page.tsx', '--owner', 'agent2'], repo),
    'bracket-dir glob vs literal',
  );
}

// Empty and whitespace-only paths are rejected before touching state —
// a stored empty path would brick every later read of file-claims.json.
{
  const repo = makeRepo();
  ok(run(['start', 'Empty path task', '--owner', 'Codex'], repo), 'start');
  const empty = run(['claim', '', '--owner', 'Codex'], repo);
  assert.notEqual(empty.status, 0, 'empty path should be rejected');
  assert.match(JSON.parse(empty.stdout).error, /non-empty/);
  const blank = run(['claim', '   ', '--owner', 'Codex'], repo);
  assert.notEqual(blank.status, 0, 'whitespace path should be rejected');
  // State stays healthy: a normal claim still works afterwards.
  ok(run(['claim', 'src/ok.ts', '--owner', 'Codex'], repo), 'state not poisoned');
}

// Same owner extending their own claim on the active task is allowed.
{
  const repo = freshRepoWithClaim('tests/*');
  ok(
    run(['claim', 'tests/more.test.js', '--owner', 'Codex'], repo),
    'same owner overlapping claim should succeed',
  );
}

console.log('claim overlap tests passed');

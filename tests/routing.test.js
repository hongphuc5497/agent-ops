#!/usr/bin/env node
// Per-repo routing override. Cases proven here:
//   1. No `.ai/routing.json` → falls through to hardcoded built-in routes
//   2. Keyword match → custom route wins
//   3. Regex match → custom route wins
//   4. No rule matches → falls through to hardcoded routes
//   5. Partial route override → missing fields filled from hardcoded default
//   6. Malformed JSON → typed error with remedy hint, non-zero exit
//   7. Rule order matters → first match wins, later rules don't fire
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-routing-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  return dir;
}

function route(description, repo) {
  return spawnSync('python3', [tool, 'route', description], { cwd: repo, encoding: 'utf8' });
}

function writeRouting(repo, payload) {
  fs.writeFileSync(path.join(repo, '.ai', 'routing.json'), JSON.stringify(payload, null, 2));
}

function ok(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return JSON.parse(result.stdout);
}

function testNoFileFallsThroughToHardcoded() {
  const repo = makeRepo();
  const payload = ok(route('fix the auth bug', repo), 'no routing.json');
  // 'bug' triggers the hardcoded debugging branch.
  assert.equal(payload.route.type, 'debugging');
  assert.equal(payload.route.owner, 'Codex');
  assert.match(payload.route.workflow, /debugging\.md$/);
}

function testKeywordMatchWins() {
  const repo = makeRepo();
  writeRouting(repo, {
    rules: [
      {
        name: 'security',
        when: { any: [{ keyword: 'audit' }] },
        route: {
          type: 'security',
          owner: 'Claude',
          workflow: '.ai/workflows/security.md',
          verification: 'threat model + failing test against vulnerable path',
        },
      },
    ],
  });
  const payload = ok(route('quarterly security audit', repo), 'keyword match');
  assert.equal(payload.route.type, 'security');
  assert.equal(payload.route.owner, 'Claude');
  assert.equal(payload.route.workflow, '.ai/workflows/security.md');
}

function testRegexMatchWins() {
  const repo = makeRepo();
  writeRouting(repo, {
    rules: [
      {
        name: 'auth-changes',
        when: { any: [{ regex: '(?i)\\bauth(n|z)?\\b' }] },
        route: { owner: 'Codex', type: 'auth' },
      },
    ],
  });
  const payload = ok(route('Rework AuthN flow', repo), 'regex match');
  assert.equal(payload.route.type, 'auth');
  assert.equal(payload.route.owner, 'Codex');
}

function testNoRuleMatchesFallsThrough() {
  const repo = makeRepo();
  writeRouting(repo, {
    rules: [
      {
        name: 'security',
        when: { any: [{ keyword: 'audit' }] },
        route: { owner: 'Claude', type: 'security' },
      },
    ],
  });
  // 'add caching layer' doesn't match 'audit'; should land on the default
  // (hardcoded 'feature' branch).
  const payload = ok(route('add caching layer', repo), 'fallback when no rule matches');
  assert.equal(payload.route.type, 'feature');
  assert.equal(payload.route.owner, 'Codex');
}

function testPartialRouteOverrideMergesWithDefault() {
  const repo = makeRepo();
  writeRouting(repo, {
    rules: [
      {
        name: 'always-claude',
        when: { any: [{ regex: '.*' }] },
        route: { owner: 'Claude' },
      },
    ],
  });
  // Description matches the built-in debugging keyword 'bug' AND our
  // catch-all rule. The catch-all fires first (rules win over hardcoded);
  // owner is overridden, but workflow/verification fall back to the
  // hardcoded debugging defaults so the user keeps the keyword-driven
  // workflow choice.
  const payload = ok(route('fix this bug', repo), 'partial override');
  assert.equal(payload.route.owner, 'Claude');
  assert.match(payload.route.workflow, /debugging\.md$/, 'workflow inherited from hardcoded default');
  assert.match(payload.route.verification, /reproduce/, 'verification inherited');
}

function testMalformedJsonEmitsTypedError() {
  const repo = makeRepo();
  fs.writeFileSync(path.join(repo, '.ai', 'routing.json'), 'not json');
  const result = route('anything', repo);
  assert.notEqual(result.status, 0, 'malformed json should fail');
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  // The read_json helper emits the "invalid json in" message; the remedy
  // hint points the user at recovery.
  assert.match(payload.error, /invalid json/i);
  assert.match(payload.remedy || '', /restore|delete/i);
}

function testInvalidSchemaEmitsValidationProblems() {
  const repo = makeRepo();
  writeRouting(repo, {
    rules: [
      {
        // missing 'name'
        when: { any: [{ regex: '(' }] }, // unparseable regex
        route: 'not an object', // wrong type
      },
    ],
  });
  const result = route('anything', repo);
  assert.notEqual(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /routing\.json failed validation/);
  assert.ok(Array.isArray(payload.problems));
  // At minimum we should flag the unparseable regex and the bad route type.
  const joined = payload.problems.join('\n');
  assert.match(joined, /regex is invalid/);
  assert.match(joined, /route must be an object/);
}

function testRuleOrderMatters() {
  const repo = makeRepo();
  writeRouting(repo, {
    rules: [
      {
        name: 'first',
        when: { any: [{ keyword: 'bug' }] },
        route: { owner: 'Alice' },
      },
      {
        name: 'second',
        when: { any: [{ keyword: 'bug' }] },
        route: { owner: 'Bob' },
      },
    ],
  });
  const payload = ok(route('fix a bug', repo), 'first rule wins');
  assert.equal(payload.route.owner, 'Alice');
}

testNoFileFallsThroughToHardcoded();
testKeywordMatchWins();
testRegexMatchWins();
testNoRuleMatchesFallsThrough();
testPartialRouteOverrideMergesWithDefault();
testMalformedJsonEmitsTypedError();
testInvalidSchemaEmitsValidationProblems();
testRuleOrderMatters();
console.log('routing tests passed');

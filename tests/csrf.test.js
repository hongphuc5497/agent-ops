#!/usr/bin/env node
// CSRF protection on the kanban server. Loopback binding + Host check is
// good defense in depth, but a malicious page the user happens to load can
// still drive-by-POST to 127.0.0.1. The server requires a random per-startup
// token, injected into the HTML and sent as `x-csrf-token` on mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const server = path.join(root, 'bin', 'kanban-server.js');

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-csrf-'));
spawnSync('git', ['init', repo], { stdio: 'ignore' });
spawnSync('bash', [path.join(root, 'scripts', 'init-repo.sh'), repo], {
  cwd: root,
  stdio: 'ignore',
});

const child = spawn(process.execPath, [server, '--port', '0', '--no-open'], {
  cwd: repo,
  env: { ...process.env, AGENT_OPS_TEST_JSON: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
let errors = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  errors += chunk.toString();
});

setTimeout(async () => {
  try {
    const line = output.split('\n').find((item) => item.trim().startsWith('{'));
    assert.ok(line, `missing startup json:\nstdout:\n${output}\nstderr:\n${errors}`);
    const info = JSON.parse(line);
    assert.ok(typeof info.csrf === 'string' && info.csrf.length >= 32, 'csrf in startup info');

    // 1. GET requests are exempt — snapshot still works with no token.
    const snapshot = await fetch(`${info.url}/api/snapshot`);
    assert.equal(snapshot.status, 200);

    // 2. POST without token → 403, clear error message.
    const without = await fetch(`${info.url}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'should not exist' }),
    });
    assert.equal(without.status, 403);
    const blocked = await without.json();
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /csrf/i);

    // 3. POST with WRONG token → 403.
    const wrong = await fetch(`${info.url}/api/tasks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'definitely-not-the-real-token',
      },
      body: JSON.stringify({ title: 'still should not exist' }),
    });
    assert.equal(wrong.status, 403);

    // 4. POST with correct token → 201 (task created).
    const ok = await fetch(`${info.url}/api/tasks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': info.csrf,
      },
      body: JSON.stringify({ title: 'csrf accepted', owner: 'Codex' }),
    });
    assert.equal(ok.status, 201);
    const created = await ok.json();
    assert.equal(created.ok, true);

    // 5. HTML response has the token injected into the meta tag (no placeholder left).
    const html = await (await fetch(info.url)).text();
    assert.match(html, /<meta name="csrf-token" content="[a-f0-9]{32,}">/);
    assert.equal(html.includes('__AGENT_OPS_CSRF__'), false, 'placeholder not replaced');

    child.kill();
    console.log('csrf tests passed');
  } catch (error) {
    child.kill();
    console.error(error);
    process.exit(1);
  }
}, 800);

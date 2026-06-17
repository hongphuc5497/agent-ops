#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const server = path.join(root, 'bin', 'kanban-server.js');

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-kanban-server-'));
spawnSync('git', ['init', repo], { stdio: 'ignore' });
spawnSync('bash', [path.join(root, 'scripts/init-repo.sh'), repo], { cwd: root, stdio: 'ignore' });

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
    assert.ok(info.url.startsWith('http://127.0.0.1:'));

    const snapshot = await fetch(`${info.url}/api/snapshot`);
    assert.equal(snapshot.status, 200);
    const payload = await snapshot.json();
    assert.equal(payload.ok, true);

    const home = await fetch(info.url);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /Agent Ops Kanban/);
    assert.match(html, /id="task-drawer"/);

    const css = await fetch(`${info.url}/styles.css`);
    assert.equal(css.status, 200);

    const js = await fetch(`${info.url}/app.js`);
    assert.equal(js.status, 200);

    child.kill();
    console.log('kanban server tests passed');
  } catch (error) {
    child.kill();
    console.error(error);
    process.exit(1);
  }
}, 600);

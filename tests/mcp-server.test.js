#!/usr/bin/env node
// MCP server golden transcript: a scripted client speaks newline-delimited
// JSON-RPC over stdio and asserts on every response. Also guards stdout
// purity — any non-JSON byte on stdout would kill a real MCP client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const server = path.join(root, 'bin', 'agent-ops-mcp.js');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');
const pkg = require(path.join(root, 'package.json'));

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mcp-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ai', 'TASK.md'), '# Active Task\n');
  fs.writeFileSync(path.join(dir, '.ai', 'protocol.md'), '# protocol\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai', 'state', 'handoffs.jsonl'), '');
  fs.copyFileSync(tool, path.join(dir, 'scripts', 'agent-ops-tool.py'));
  return dir;
}

function rpcSession(repo, requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [server, '--repo', repo], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      const lines = stdout.split('\n').filter((line) => line.trim());
      const messages = [];
      for (const line of lines) {
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          reject(new Error(`stdout purity violated — non-JSON line: ${line}`));
          return;
        }
        messages.push(parsed);
      }
      resolve({ messages, stderr });
    });
    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
    child.stdin.end();
  });
}

(async () => {
  // --- golden transcript: initialize → list → call through a task lifecycle
  const repo = makeRepo();
  const { messages } = await rpcSession(repo, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'status', arguments: {} } },
    {
      jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'start', arguments: { title: 'MCP smoke task', owner: 'claude' } },
    },
    {
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'claim', arguments: { paths: ['src/*'], owner: 'claude' } },
    },
    {
      jsonrpc: '2.0', id: 6, method: 'tools/call',
      params: { name: 'claim', arguments: { paths: ['src/deep.ts'], owner: 'codex' } },
    },
    {
      jsonrpc: '2.0', id: 7, method: 'tools/call',
      params: { name: 'finish', arguments: { result: 'done', verification: 'smoke' } },
    },
    { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'nope', arguments: {} } },
    { jsonrpc: '2.0', id: 9, method: 'bogus/method' },
  ]);

  const byId = new Map(messages.map((m) => [m.id, m]));

  const init = byId.get(1);
  assert.equal(init.result.serverInfo.name, 'agent-ops');
  assert.equal(init.result.serverInfo.version, pkg.version);
  assert.ok(init.result.protocolVersion);

  const list = byId.get(2);
  const names = list.result.tools.map((t) => t.name);
  for (const expected of ['status', 'start', 'claim', 'release', 'handoff', 'finish', 'check', 'doctor']) {
    assert.ok(names.includes(expected), `tools/list missing ${expected}`);
  }
  assert.ok(list.result.tools.every((t) => t.inputSchema.type === 'object'));

  const status = byId.get(3);
  assert.equal(status.result.isError, false);
  assert.match(status.result.content[0].text, /"active": false/);

  assert.equal(byId.get(4).result.isError, false, 'start should succeed');
  assert.equal(byId.get(5).result.isError, false, 'claim should succeed');

  // Overlapping claim by another owner → tool-level error, NOT protocol error
  const conflict = byId.get(6);
  assert.equal(conflict.result.isError, true);
  assert.match(conflict.result.content[0].text, /claim conflict/);

  assert.equal(byId.get(7).result.isError, false, 'finish should succeed');

  const unknownTool = byId.get(8);
  assert.equal(unknownTool.result.isError, true);
  assert.match(unknownTool.result.content[0].text, /unknown tool/);

  const unknownMethod = byId.get(9);
  assert.equal(unknownMethod.error.code, -32601);

  // --- uninitialized repo is refused at startup
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-mcp-empty-'));
  const refused = spawnSync(process.execPath, [server, '--repo', empty], {
    encoding: 'utf8', input: '',
  });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /not an initialized Agent Ops repo/);

  // --- version skew surfaces in the status tool result
  const skewRepo = makeRepo();
  const vendored = path.join(skewRepo, 'scripts', 'agent-ops-tool.py');
  fs.writeFileSync(
    vendored,
    fs.readFileSync(vendored, 'utf8').replace(/TOOL_VERSION = "[^"]+"/, 'TOOL_VERSION = "0.0.1"'),
  );
  const skew = await rpcSession(skewRepo, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'status', arguments: {} } },
  ]);
  const skewStatus = skew.messages.find((m) => m.id === 2);
  assert.match(skewStatus.result.content[0].text, /warning: repo-vendored tool is v0\.0\.1/);

  console.log('mcp server tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

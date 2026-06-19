#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = process.cwd();
const staticRoot = path.join(packageRoot, 'web', 'kanban');

// Per-process CSRF token. Generated once at startup, injected into index.html,
// and required as the `x-csrf-token` header on every mutating request. Defends
// against drive-by POSTs from any page the user happens to load — loopback
// binding alone does not, because a malicious page can still fetch 127.0.0.1.
const CSRF_TOKEN = crypto.randomBytes(32).toString('hex');
const CSRF_PLACEHOLDER = '__AGENT_OPS_CSRF__';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseArgs(argv) {
  const options = { port: 4783, open: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 0 || value > 65535) {
        throw new Error('--port must be a number from 0 to 65535');
      }
      options.port = value;
      index += 1;
    } else if (arg === '--no-open') {
      options.open = false;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

function usage() {
  process.stdout.write(`agent-ops kanban

Usage:
  agent-ops kanban [--port <port>] [--no-open]
`);
}

function sendJson(res, status, payload) {
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function commandArgs(body, allowed) {
  const args = [];
  for (const [key, flag] of allowed) {
    const value = body[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        args.push(flag, String(item));
      }
    } else if (typeof value === 'boolean') {
      if (value) {
        args.push(flag);
      }
    } else {
      args.push(flag, String(value));
    }
  }
  return args;
}

function runTool(args) {
  const script = path.join(repoRoot, 'scripts', 'agent-ops-tool.py');
  if (!fs.existsSync(script)) {
    return {
      status: 1,
      payload: {
        ok: false,
        error: 'this repo is not initialized. Run agent-ops init first.',
        command: `python3 scripts/agent-ops-tool.py ${args.join(' ')}`,
      },
    };
  }
  const result = spawnSync('python3', [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  let payload;
  try {
    payload = JSON.parse(result.stdout || '{}');
  } catch {
    payload = { ok: false, error: 'invalid command output', stdout: result.stdout };
  }
  if (result.status !== 0) {
    payload.ok = false;
    payload.command = `python3 scripts/agent-ops-tool.py ${args.join(' ')}`;
    payload.stderr = result.stderr.trim();
  }
  return { status: result.status ?? 1, payload };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 64 * 1024) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function isLoopbackHost(req) {
  const host = req.headers.host;
  if (!host) {
    return true;
  }
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === '127.0.0.1' || name === 'localhost' || name === '::1';
}

function serveStatic(req, res) {
  const requestPath = new URL(req.url, 'http://127.0.0.1').pathname;
  const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const filePath = path.resolve(staticRoot, relative);
  if ((filePath !== staticRoot && !filePath.startsWith(staticRoot + path.sep)) || !fs.existsSync(filePath)) {
    sendJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  const ext = path.extname(filePath);
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
  };
  // Inject the per-process CSRF token into HTML so the kanban JS can read it
  // from <meta name="csrf-token"> and send it on every mutating request. Other
  // static assets pass through untouched.
  let body;
  if (ext === '.html') {
    const html = fs.readFileSync(filePath, 'utf8').replace(CSRF_PLACEHOLDER, CSRF_TOKEN);
    body = Buffer.from(html, 'utf8');
  } else {
    body = fs.readFileSync(filePath);
  }
  res.writeHead(200, {
    'content-type': types[ext] || 'application/octet-stream',
    'content-length': body.length,
  });
  res.end(body);
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/api/snapshot') {
    const result = runTool(['kanban-snapshot']);
    sendJson(res, result.status === 0 ? 200 : 500, result.payload);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/check') {
    const result = runTool(['check']);
    sendJson(res, result.status === 0 ? 200 : 500, result.payload);
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    if (!body.title) {
      sendJson(res, 400, { ok: false, error: 'title is required' });
      return;
    }
    const args = [
      'create-task',
      body.title,
      ...commandArgs(body, [
        ['owner', '--owner'],
        ['repo', '--repo'],
        ['workflow', '--workflow'],
        ['verification', '--verification'],
        ['files', '--files'],
        ['outOfScope', '--out-of-scope'],
        ['active', '--active'],
      ]),
    ];
    const result = runTool(args);
    sendJson(res, result.status === 0 ? 201 : 400, result.payload);
    return;
  }

  const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (req.method === 'PATCH' && taskMatch) {
    const args = [
      'update-task',
      taskMatch[1],
      ...commandArgs(body, [
        ['title', '--title'],
        ['owner', '--owner'],
        ['workflow', '--workflow'],
        ['verification', '--verification'],
        ['files', '--files'],
        ['outOfScope', '--out-of-scope'],
      ]),
    ];
    const result = runTool(args);
    sendJson(res, result.status === 0 ? 200 : 400, result.payload);
    return;
  }

  const claimMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/claim$/);
  if (req.method === 'POST' && claimMatch) {
    const paths = Array.isArray(body.paths) ? body.paths : [];
    if (!paths.length) {
      sendJson(res, 400, { ok: false, error: 'paths are required' });
      return;
    }
    const args = ['claim', ...paths, ...commandArgs(body, [['owner', '--owner'], ['reason', '--reason']])];
    const result = runTool(args);
    sendJson(res, result.status === 0 ? 200 : 400, result.payload);
    return;
  }

  const finishMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/finish$/);
  if (req.method === 'POST' && finishMatch) {
    const resultValue = body.result || 'done';
    const args = ['finish', resultValue, ...commandArgs(body, [['verification', '--verification']])];
    const result = runTool(args);
    sendJson(res, result.status === 0 ? 200 : 400, result.payload);
    return;
  }

  sendJson(res, 404, { ok: false, error: 'not found' });
}

function openBrowser(url) {
  if (process.platform === 'darwin') {
    spawnSync('open', [url], { stdio: 'ignore' });
  } else if (process.platform === 'win32') {
    spawnSync('cmd', ['/c', 'start', url], { stdio: 'ignore' });
  } else {
    spawnSync('xdg-open', [url], { stdio: 'ignore' });
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
  if (options.help) {
    usage();
    return;
  }

  const server = http.createServer((req, res) => {
    if (!isLoopbackHost(req)) {
      sendJson(res, 403, { ok: false, error: 'forbidden: non-loopback host' });
      return;
    }
    // CSRF check on mutating /api/* calls: the kanban UI gets the token
    // injected into the HTML and sends it as `x-csrf-token`. A drive-by POST
    // from a malicious page has no way to read the token, so it gets rejected.
    if (req.url.startsWith('/api/') && !SAFE_METHODS.has(req.method)) {
      const presented = req.headers['x-csrf-token'];
      if (typeof presented !== 'string' || presented !== CSRF_TOKEN) {
        sendJson(res, 403, { ok: false, error: 'forbidden: csrf token missing or invalid' });
        return;
      }
    }
    if (req.url.startsWith('/api/')) {
      handleApi(req, res);
    } else {
      serveStatic(req, res);
    }
  });

  server.listen(options.port, '127.0.0.1', () => {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}`;
    if (process.env.AGENT_OPS_TEST_JSON === '1') {
      process.stdout.write(
        `${JSON.stringify({ ok: true, url, repo: repoRoot, csrf: CSRF_TOKEN })}\n`,
      );
    } else {
      process.stdout.write(`Agent Ops Kanban: ${url}\n`);
    }
    if (options.open) {
      openBrowser(url);
    }
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

main();

#!/usr/bin/env node
// Agent Ops MCP server — stdio transport, newline-delimited JSON-RPC.
//
// Hand-rolled on purpose: the package ships with zero runtime dependencies,
// and eight tools need exactly three methods (initialize, tools/list,
// tools/call). Every tool call spawns the repo-vendored Python tool and
// returns its JSON verbatim, so the MCP surface and the CLI can never
// disagree about behavior. stdout carries ONLY JSON-RPC lines — any stray
// byte kills the client — so all diagnostics go to stderr.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

const PROTOCOL_VERSION = '2025-06-18';
const pkg = require(path.join(__dirname, '..', 'package.json'));

function parseArgs(argv) {
  const options = { repo: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--repo') {
      const value = argv[i + 1];
      if (!value) {
        process.stderr.write('agent-ops mcp: --repo requires a path\n');
        process.exit(2);
      }
      options.repo = path.resolve(value);
      i += 1;
    } else {
      process.stderr.write(`agent-ops mcp: unknown option '${argv[i]}'\n`);
      process.exit(2);
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const repoRoot = options.repo;
const toolPath = path.join(repoRoot, 'scripts', 'agent-ops-tool.py');

if (!fs.existsSync(path.join(repoRoot, '.ai', 'protocol.md')) || !fs.existsSync(toolPath)) {
  process.stderr.write(
    `agent-ops mcp: ${repoRoot} is not an initialized Agent Ops repo ` +
    '(missing .ai/protocol.md or scripts/agent-ops-tool.py). ' +
    'Run `npx @hongphuc5497/agent-ops@latest init` there first, ' +
    'or pass --repo <path>.\n',
  );
  process.exit(1);
}

// The MCP server ships with the npm package but executes the repo-vendored
// Python tool, which may be older with a different JSON shape. Surface skew
// in the status tool result — stderr is invisible to MCP clients.
let versionSkew = '';
try {
  const source = fs.readFileSync(toolPath, 'utf8');
  const match = /TOOL_VERSION\s*=\s*"([^"]+)"/.exec(source);
  if (match && match[1] !== pkg.version) {
    versionSkew =
      `warning: repo-vendored tool is v${match[1]} but this MCP server is v${pkg.version}; ` +
      'run `agent-ops upgrade` in the repo to sync';
    process.stderr.write(`agent-ops mcp: ${versionSkew}\n`);
  }
} catch {
  /* unreadable tool — the first call will surface the real error */
}

const PATHS_ARG = {
  type: 'array',
  items: { type: 'string' },
  description: 'Repo-relative paths or globs (e.g. "src/auth/*")',
};

const TOOLS = [
  {
    name: 'status',
    description: 'Read the active task and current file claims.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    argv: () => ['status'],
  },
  {
    name: 'route',
    description: 'Suggest which agent and workflow should own a task, from its description.',
    inputSchema: {
      type: 'object',
      properties: { description: { type: 'string' } },
      required: ['description'],
      additionalProperties: false,
    },
    argv: (a) => ['route', a.description],
  },
  {
    name: 'start',
    description: 'Start (lock) a new active task. Fails if a task is already active.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        owner: { type: 'string' },
        workflow: { type: 'string' },
        verification: { type: 'string' },
        files: PATHS_ARG,
      },
      required: ['title'],
      additionalProperties: false,
    },
    argv: (a) => {
      const argv = ['start', a.title];
      if (a.owner) argv.push('--owner', a.owner);
      if (a.workflow) argv.push('--workflow', a.workflow);
      if (a.verification) argv.push('--verification', a.verification);
      for (const f of a.files || []) argv.push('--files', f);
      return argv;
    },
  },
  {
    name: 'claim',
    description:
      'Claim files for the active task before editing them. Conflicts with overlapping claims by other owners.',
    inputSchema: {
      type: 'object',
      properties: {
        paths: PATHS_ARG,
        owner: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['paths'],
      additionalProperties: false,
    },
    argv: (a) => {
      const argv = ['claim', ...a.paths];
      if (a.owner) argv.push('--owner', a.owner);
      if (a.reason) argv.push('--reason', a.reason);
      return argv;
    },
  },
  {
    name: 'release',
    description:
      'Release claims without finishing the task (crash recovery). Own claims only, unless force is set (audited, requires reason).',
    inputSchema: {
      type: 'object',
      properties: {
        paths: PATHS_ARG,
        owner: { type: 'string' },
        all: { type: 'boolean', description: 'Release every claim owned by owner' },
        force: { type: 'boolean' },
        reason: { type: 'string', description: 'Required with force' },
      },
      additionalProperties: false,
    },
    argv: (a) => {
      const argv = ['claim', '--release', ...(a.paths || [])];
      if (a.all) argv.push('--release-all');
      if (a.owner) argv.push('--owner', a.owner);
      if (a.force) argv.push('--force');
      if (a.reason) argv.push('--reason', a.reason);
      return argv;
    },
  },
  {
    name: 'handoff',
    description: 'Record a delegation of work to another agent, with acceptance criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        acceptance: { type: 'string' },
        files: PATHS_ARG,
        verification: { type: 'string' },
        notes: { type: 'string' },
        from_owner: { type: 'string' },
      },
      required: ['to', 'acceptance'],
      additionalProperties: false,
    },
    argv: (a) => {
      const argv = ['handoff', '--to', a.to, '--acceptance', a.acceptance];
      if (a.verification) argv.push('--verification', a.verification);
      if (a.notes) argv.push('--notes', a.notes);
      if (a.from_owner) argv.push('--from-owner', a.from_owner);
      for (const f of a.files || []) argv.push('--files', f);
      return argv;
    },
  },
  {
    name: 'finish',
    description: 'Finish the active task: done, parked, or killed. Clears its claims.',
    inputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string', enum: ['done', 'parked', 'killed'] },
        verification: { type: 'string' },
      },
      required: ['result'],
      additionalProperties: false,
    },
    argv: (a) => {
      const argv = ['finish', a.result];
      if (a.verification) argv.push('--verification', a.verification);
      return argv;
    },
  },
  {
    name: 'check',
    description: 'Validate protocol health: required files, state schema, staleness.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    argv: () => ['check'],
  },
  {
    name: 'doctor',
    description: 'Detailed diagnostics: versions, stale/orphan claims, state problems.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    argv: () => ['doctor'],
  },
];

const toolsByName = new Map(TOOLS.map((tool) => [tool.name, tool]));

function callTool(name, args) {
  const tool = toolsByName.get(name);
  if (!tool) {
    return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
  }
  const result = spawnSync('python3', [toolPath, ...tool.argv(args || {})], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.error) {
    return {
      content: [
        {
          type: 'text',
          text: `failed to run agent-ops tool: ${result.error.message}. Is python3 installed?`,
        },
      ],
      isError: true,
    };
  }
  let text = (result.stdout || result.stderr || '').trim() || '(no output)';
  if (name === 'status' && versionSkew) {
    text += `\n\n${versionSkew}`;
  }
  return { content: [{ type: 'text', text }], isError: result.status !== 0 };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(request) {
  const { id, method, params } = request;
  const hasId = id !== undefined && id !== null;
  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'agent-ops', version: pkg.version },
        },
      });
      return;
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // notifications get no response
    case 'ping':
      if (hasId) send({ jsonrpc: '2.0', id, result: {} });
      return;
    case 'tools/list':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        },
      });
      return;
    case 'tools/call':
      send({
        jsonrpc: '2.0',
        id,
        result: callTool(params?.name, params?.arguments),
      });
      return;
    default:
      if (hasId) {
        send({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `method not found: ${method}` },
        });
      }
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
    return;
  }
  try {
    handle(request);
  } catch (error) {
    process.stderr.write(`agent-ops mcp: ${error.stack || error}\n`);
    if (request.id !== undefined && request.id !== null) {
      send({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: 'internal error' },
      });
    }
  }
});
rl.on('close', () => process.exit(0));

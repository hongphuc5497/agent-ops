#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
const cwd = process.cwd();

function usage() {
  process.stdout.write(`agent-ops

Usage:
  agent-ops init [target] [--dry-run] [--force]
  agent-ops install <integration> [--dry-run]
  agent-ops status
  agent-ops route <description>
  agent-ops start <title> [options]
  agent-ops claim <paths...> [options]
  agent-ops handoff [options]
  agent-ops delegate <description> [options]
  agent-ops finish done|parked|killed [options]
  agent-ops kanban [--port <port>] [--no-open]
  agent-ops check
  agent-ops version
  agent-ops help

Examples:
  npx agent-ops init
  npx agent-ops install codex
  agent-ops kanban
  agent-ops status
`);
}

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) {
    fail(result.error.message);
  }
  process.exit(result.status ?? 1);
}

function runBash(script, args, options = {}) {
  if (!fs.existsSync(script)) {
    fail(`agent-ops: missing script ${script}`);
  }
  run('bash', [script, ...args], options);
}

function repoScript(name) {
  return path.join(cwd, 'scripts', name);
}

function requireInitializedRepo(command) {
  const script = repoScript(command);
  if (!fs.existsSync(script)) {
    fail(
      `agent-ops: this repo is not initialized. Run "agent-ops init" first.`
    );
  }
  return script;
}

function version() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
  );
  process.stdout.write(`agent-ops ${pkg.version}\n`);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case undefined:
  case '':
  case '--help':
  case '-h':
  case 'help':
    usage();
    process.exit(0);
    break;
  case '--version':
  case '-v':
  case 'version':
    version();
    break;
  case 'init': {
    const target = args[0] && !args[0].startsWith('-') ? args.shift() : '.';
    runBash(path.join(packageRoot, 'scripts', 'init-repo.sh'), [target, ...args]);
    break;
  }
  case 'install':
    runBash(requireInitializedRepo('install-integration.sh'), args);
    break;
  case 'status':
  case 'route':
  case 'start':
  case 'claim':
  case 'handoff':
  case 'delegate':
  case 'finish':
  case 'check':
    runBash(requireInitializedRepo('ao'), [command, ...args]);
    break;
  case 'kanban': {
    requireInitializedRepo('agent-ops-tool.py');
    const server = path.join(packageRoot, 'bin', 'kanban-server.js');
    if (!fs.existsSync(server)) {
      fail(`agent-ops: missing server ${server}`);
    }
    run(process.execPath, [server, ...args]);
    break;
  }
  default:
    fail(`agent-ops: unknown command '${command}'. Run 'agent-ops help'.`, 2);
}

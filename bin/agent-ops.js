#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');
const cwd = process.cwd();

const SUPPORTED_AGENTS = [
  'claude',
  'codex',
  'opencode',
  'augment',
  'openclaw',
  'hermes',
];

function usage() {
  process.stdout.write(`agent-ops

Usage:
  agent-ops init [target] [--dry-run] [--force] [--interactive]
  agent-ops upgrade [target] [--dry-run]
  agent-ops install <integration> [--dry-run]
  agent-ops tutorial
  agent-ops status
  agent-ops route <description>
  agent-ops start <title> [options]
  agent-ops claim <paths...> [options]
  agent-ops claim --release <paths...> [--force --reason <why>]   crash recovery
  agent-ops handoff [options]
  agent-ops delegate <description> [options]
  agent-ops finish done|parked|killed [options]
  agent-ops hook install|uninstall [--dry-run]   pre-commit claim enforcement
  agent-ops mcp [--repo <path>]                  MCP server over stdio
  agent-ops kanban [--port <port>] [--no-open]
  agent-ops check
  agent-ops doctor [--staleness-hours <n>]
  agent-ops version
  agent-ops help

Environment:
  AGENT_OPS_OWNER          this agent's identity (per-process; beats git config agent-ops.owner)
  AGENT_OPS_SKIP_HOOK=1    bypass the pre-commit claim hook once (logged)
  AGENT_OPS_UNSAFE_NO_LOCK=1  allow state mutations where file locking is unavailable

Examples:
  npx agent-ops init --interactive
  npx agent-ops install codex
  agent-ops hook install
  claude mcp add agent-ops -- npx -y @hongphuc5497/agent-ops@latest mcp
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

// Variants that DON'T process.exit — used by orchestrating flows like
// `init --interactive` and `tutorial` that need to run multiple subprocesses
// in sequence and report a single final status.
function runBashCapture(script, args, options = {}) {
  if (!fs.existsSync(script)) {
    return { status: 1, stdout: '', stderr: `agent-ops: missing script ${script}\n` };
  }
  return spawnSync('bash', [script, ...args], {
    cwd,
    encoding: 'utf8',
    ...options,
  });
}

function runBashInline(script, args, options = {}) {
  if (!fs.existsSync(script)) {
    return 1;
  }
  const result = spawnSync('bash', [script, ...args], {
    cwd,
    stdio: 'inherit',
    ...options,
  });
  return result.status ?? 1;
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

// Build a queue of lines from a readline interface. `rl.question` reliably
// reads only the first line of piped stdin in non-TTY mode (Node's promise
// pattern can deadlock on subsequent reads), so we consume the line stream
// ourselves and treat each line as the answer to the next pending question.
function makeLineReader(rl) {
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    if (waiters.length) {
      waiters.shift()(line);
    } else {
      queue.push(line);
    }
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length) {
      waiters.shift()(null);
    }
  });
  return function nextLine() {
    if (queue.length) {
      return Promise.resolve(queue.shift());
    }
    if (closed) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => waiters.push(resolve));
  };
}

function makePrompt(rl, nextLine) {
  return async function prompt(question, defaultValue = '') {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    rl.output.write(`${question}${suffix} `);
    const line = await nextLine();
    if (line === null) {
      return defaultValue;
    }
    return line.trim() || defaultValue;
  };
}

// Interactive init: ask which agents the user runs, optionally seed a tutorial
// task, then run the standard init + install flows. This shaves the README's
// 5-minute quick start to a single command for new users.
async function interactiveInit(target, extraArgs) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const nextLine = makeLineReader(rl);
  const prompt = makePrompt(rl, nextLine);
  try {
    process.stdout.write('Agent Ops interactive setup\n\n');
    process.stdout.write(`Target repo: ${path.resolve(target)}\n`);

    const agentsRaw = await prompt(
      `Which agents do you use? (comma-separated from ${SUPPORTED_AGENTS.join(', ')})`,
      'claude,codex',
    );
    const agents = agentsRaw
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);
    const unknown = agents.filter((a) => !SUPPORTED_AGENTS.includes(a));
    if (unknown.length) {
      fail(`unknown agent(s): ${unknown.join(', ')}. Supported: ${SUPPORTED_AGENTS.join(', ')}`);
    }

    const wantTutorial = (await prompt('Seed a tutorial task to learn the protocol? (Y/n)', 'Y'))
      .toLowerCase()
      .startsWith('y');

    rl.close();

    process.stdout.write('\n> Running init...\n');
    const initStatus = runBashInline(
      path.join(packageRoot, 'scripts', 'init-repo.sh'),
      [target, ...extraArgs.filter((a) => a !== '--interactive')],
    );
    if (initStatus !== 0) {
      process.exit(initStatus);
    }

    // install-integration.sh runs RELATIVE to the target repo, so we have to
    // cd into it for those calls (and tutorial).
    const targetAbs = path.resolve(target);
    for (const agent of agents) {
      process.stdout.write(`\n> Installing integration: ${agent}\n`);
      const status = runBashInline(
        path.join(targetAbs, 'scripts', 'install-integration.sh'),
        [agent],
        { cwd: targetAbs },
      );
      if (status !== 0) {
        process.stderr.write(`agent-ops: install ${agent} failed (status ${status})\n`);
        process.exit(status);
      }
    }

    if (wantTutorial) {
      process.stdout.write('\n> Seeding tutorial task\n');
      const tutorialStatus = seedTutorial(targetAbs);
      if (tutorialStatus !== 0) {
        process.exit(tutorialStatus);
      }
    }

    process.stdout.write('\nAgent Ops setup complete.\n');
    process.stdout.write('Next:\n');
    process.stdout.write('  cd ' + targetAbs + '\n');
    process.stdout.write('  agent-ops status\n');
    if (wantTutorial) {
      process.stdout.write('  # then walk through the tutorial task file printed above\n');
    }
    process.exit(0);
  } catch (error) {
    rl.close();
    fail(error.message || String(error));
  }
}

// Copy the bundled tutorial markdown into the target repo's `.ai/tasks/` and
// start it as the active task. Returns a status code (0 = ok). Refuses if a
// task is already active so we never silently clobber real work.
function seedTutorial(targetAbs) {
  const tool = path.join(targetAbs, 'scripts', 'agent-ops-tool.py');
  if (!fs.existsSync(tool)) {
    process.stderr.write('agent-ops: target repo not initialized\n');
    return 1;
  }
  const tutorialSource = path.join(packageRoot, '.ai', 'integrations', 'templates', 'tutorial', 'first-task.md');
  if (!fs.existsSync(tutorialSource)) {
    process.stderr.write(`agent-ops: tutorial content missing at ${tutorialSource}\n`);
    return 1;
  }

  const statusResult = spawnSync('python3', [tool, 'status'], { cwd: targetAbs, encoding: 'utf8' });
  if (statusResult.status === 0) {
    try {
      const statusJson = JSON.parse(statusResult.stdout);
      if (statusJson.active) {
        process.stderr.write(
          `agent-ops: an active task already exists (${statusJson.task?.title || 'unknown'}). ` +
            'Finish or park it before seeding the tutorial.\n',
        );
        return 1;
      }
    } catch {
      // fall through — start will fail loudly if state is broken
    }
  }

  const start = spawnSync(
    'python3',
    [
      tool,
      'start',
      'Agent Ops Tutorial',
      '--owner',
      'you',
      '--workflow',
      'tutorial',
      '--verification',
      'complete every step in the tutorial task file',
    ],
    { cwd: targetAbs, encoding: 'utf8' },
  );
  if (start.status !== 0) {
    process.stderr.write(start.stderr || 'agent-ops: tutorial start failed\n');
    return start.status ?? 1;
  }

  let started;
  try {
    started = JSON.parse(start.stdout);
  } catch {
    process.stderr.write('agent-ops: could not parse start output\n');
    return 1;
  }

  const taskFileRel = started?.task?.task_file;
  if (!taskFileRel) {
    process.stderr.write('agent-ops: start did not return a task_file path\n');
    return 1;
  }

  // Overwrite the autogenerated task markdown with the rich tutorial content.
  // The autogenerated front-matter stays consistent with active-task.json
  // because we don't rewrite the JSON state.
  const taskFile = path.join(targetAbs, taskFileRel);
  const tutorialContent = fs.readFileSync(tutorialSource, 'utf8');
  fs.writeFileSync(taskFile, tutorialContent);

  process.stdout.write(`Tutorial task created: ${taskFileRel}\n`);
  process.stdout.write('Open it in your editor and follow the steps.\n');
  return 0;
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
    if (args.includes('--interactive')) {
      interactiveInit(target, args).catch((error) => fail(error.message || String(error)));
      break;
    }
    runBash(path.join(packageRoot, 'scripts', 'init-repo.sh'), [target, ...args]);
    break;
  }
  case 'upgrade': {
    const target = args[0] && !args[0].startsWith('-') ? args.shift() : '.';
    runBash(path.join(packageRoot, 'scripts', 'init-repo.sh'), [
      target,
      '--upgrade',
      ...args,
    ]);
    break;
  }
  case 'install':
    runBash(requireInitializedRepo('install-integration.sh'), args);
    break;
  case 'tutorial': {
    requireInitializedRepo('agent-ops-tool.py');
    const status = seedTutorial(cwd);
    process.exit(status);
    break;
  }
  case 'status':
  case 'route':
  case 'start':
  case 'claim':
  case 'handoff':
  case 'delegate':
  case 'finish':
  case 'check':
  case 'doctor':
  case 'claims-check':
  case 'hook':
    runBash(requireInitializedRepo('ao'), [command, ...args]);
    break;
  case 'install-hook':
    // Guessability alias — users will try both shapes.
    runBash(requireInitializedRepo('ao'), ['hook', 'install', ...args]);
    break;
  case 'mcp': {
    // The server validates its target itself; --repo may point elsewhere.
    if (!args.includes('--repo')) {
      requireInitializedRepo('agent-ops-tool.py');
    }
    const server = path.join(packageRoot, 'bin', 'agent-ops-mcp.js');
    if (!fs.existsSync(server)) {
      fail(`agent-ops: missing server ${server}`);
    }
    run(process.execPath, [server, ...args]);
    break;
  }
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

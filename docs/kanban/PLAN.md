# Agent Ops Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `agent-ops kanban`, a local browser UI for reading, creating, and updating Agent Ops tasks in the current repo.

**Architecture:** Add command-backed task snapshot and update operations to `scripts/agent-ops-tool.py`, then serve a dependency-free browser UI from a small Node HTTP server. The browser never writes repo files directly; it calls the local server, which calls Agent Ops commands in the current working repo.

**Tech Stack:** Node built-ins (`http`, `fs`, `child_process`), Python stdlib, plain HTML/CSS/JS, existing Agent Ops scripts.

---

## Files

- Create: `bin/kanban-server.js`
- Create: `web/kanban/index.html`
- Create: `web/kanban/styles.css`
- Create: `web/kanban/app.js`
- Create: `tests/kanban-data.test.js`
- Create: `tests/kanban-server.test.js`
- Modify: `bin/agent-ops.js`
- Modify: `scripts/agent-ops-tool.py`
- Modify: `scripts/agent-ops-check.sh`
- Modify: `scripts/init-repo.sh`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/SETUP.md`
- Modify: `docs/kanban/DESIGN.md` only if implementation exposes a design gap

## Task 1: Add Kanban Snapshot Data Command

**Files:**
- Modify: `scripts/agent-ops-tool.py`
- Create: `tests/kanban-data.test.js`

- [x] **Step 1: Write failing snapshot test**

Create `tests/kanban-data.test.js` with a temp repo fixture:

```js
#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const tool = path.join(root, 'scripts', 'agent-ops-tool.py');

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function ok(result, label) {
  assert.equal(result.status, 0, `${label}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ao-kanban-data-'));
  fs.mkdirSync(path.join(dir, '.ai', 'tasks', 'archive'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.ai', 'state'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'TASK.md'), '# Active Task\n\nStatus: none\n');
  fs.writeFileSync(path.join(dir, '.ai/state/file-claims.json'), '{ "claims": [] }\n');
  fs.writeFileSync(path.join(dir, '.ai/state/handoffs.jsonl'), '');
  return dir;
}

const repo = makeRepo();
ok(run('python3', [tool, 'create-task', 'Backlog task', '--owner', 'Codex'], repo), 'create backlog');
ok(run('python3', [tool, 'start', 'Active task', '--owner', 'Codex'], repo), 'start active');
ok(run('python3', [tool, 'finish', 'done', '--verification', 'node test'], repo), 'finish active');

const snapshot = ok(run('python3', [tool, 'kanban-snapshot'], repo), 'snapshot');
const data = JSON.parse(snapshot.stdout);

assert.equal(data.ok, true);
assert.equal(data.columns.backlog.length, 1);
assert.equal(data.columns.done.length, 1);
assert.equal(data.columns.backlog[0].title, 'Backlog task');
assert.equal(data.columns.done[0].title, 'Active task');
assert.ok(Array.isArray(data.claims));
assert.ok(Array.isArray(data.handoffs));

console.log('kanban data tests passed');
```

- [x] **Step 2: Run test and verify RED**

Run:

```bash
node tests/kanban-data.test.js
```

Expected: fails because `create-task` and `kanban-snapshot` are unknown commands.

- [x] **Step 3: Implement `create-task` and `kanban-snapshot`**

In `scripts/agent-ops-tool.py`:

- Add a helper to build a task payload without activating it.
- Add `command_create_task`.
- Add `command_kanban_snapshot`.
- Register both in `build_parser`.

Behavior:

- `create-task TITLE` creates `.ai/tasks/<id>.md` with status `backlog`.
- `create-task TITLE --active` delegates to existing start semantics.
- `kanban-snapshot` reads active, backlog task markdown, archive JSON, claims, handoffs, and check output.
- Do not include duplicate active task markdown in backlog.

- [x] **Step 4: Run test and verify GREEN**

Run:

```bash
node tests/kanban-data.test.js
```

Expected: `kanban data tests passed`.

## Task 2: Add Command-Backed Task Update

**Files:**
- Modify: `scripts/agent-ops-tool.py`
- Modify: `tests/kanban-data.test.js`

- [x] **Step 1: Add failing update test**

Append to `tests/kanban-data.test.js`:

```js
const update = ok(
  run('python3', [tool, 'update-task', data.columns.backlog[0].id, '--title', 'Updated backlog', '--verification', 'npm test'], repo),
  'update backlog'
);
const updatePayload = JSON.parse(update.stdout);
assert.equal(updatePayload.ok, true);

const afterUpdate = JSON.parse(ok(run('python3', [tool, 'kanban-snapshot'], repo), 'snapshot after update').stdout);
assert.equal(afterUpdate.columns.backlog[0].title, 'Updated backlog');
assert.equal(afterUpdate.columns.backlog[0].verification, 'npm test');
```

- [x] **Step 2: Run test and verify RED**

Run:

```bash
node tests/kanban-data.test.js
```

Expected: fails because `update-task` is unknown.

- [x] **Step 3: Implement `update-task`**

In `scripts/agent-ops-tool.py`:

- Add `command_update_task`.
- Only allow ids matching `^[0-9]{8}-[0-9]{6}-[a-z0-9-]+$`.
- Locate the task in active state, `.ai/tasks/*.md`, or archive JSON.
- Update supported fields: title, owner, workflow, verification, files in scope, out of scope.
- If active, rewrite `.ai/state/active-task.json`, `TASK.md`, and matching task markdown.
- If archived, rewrite archive JSON only.
- Return the updated task JSON.

- [x] **Step 4: Run test and verify GREEN**

Run:

```bash
node tests/kanban-data.test.js
```

Expected: all data tests pass.

## Task 3: Add Local Kanban Server

**Files:**
- Create: `bin/kanban-server.js`
- Create: `tests/kanban-server.test.js`
- Modify: `package.json`

- [x] **Step 1: Write failing server test**

Create `tests/kanban-server.test.js`:

```js
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
  encoding: 'utf8',
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});

setTimeout(async () => {
  try {
    const line = output.split('\n').find((item) => item.trim().startsWith('{'));
    assert.ok(line, `missing startup json: ${output}`);
    const info = JSON.parse(line);
    assert.ok(info.url.startsWith('http://127.0.0.1:'));

    const snapshot = await fetch(`${info.url}/api/snapshot`);
    assert.equal(snapshot.status, 200);
    const payload = await snapshot.json();
    assert.equal(payload.ok, true);

    child.kill();
    console.log('kanban server tests passed');
  } catch (error) {
    child.kill();
    console.error(error);
    process.exit(1);
  }
}, 600);
```

- [x] **Step 2: Run test and verify RED**

Run:

```bash
node tests/kanban-server.test.js
```

Expected: fails because `bin/kanban-server.js` does not exist.

- [x] **Step 3: Implement server**

Create `bin/kanban-server.js`:

- Use Node built-ins only.
- Serve static files from `web/kanban`.
- Bind to `127.0.0.1`.
- Accept `--port`, `--no-open`.
- Print JSON startup info when `AGENT_OPS_TEST_JSON=1`.
- Implement routes:
  - `GET /`
  - `GET /api/snapshot`
  - `POST /api/tasks`
  - `PATCH /api/tasks/:id`
  - `POST /api/tasks/:id/claim`
  - `POST /api/tasks/:id/finish`
  - `POST /api/check`
- Use `spawnSync('python3', ['scripts/agent-ops-tool.py', ...])` in repo cwd.

- [x] **Step 4: Run test and verify GREEN**

Run:

```bash
node tests/kanban-server.test.js
```

Expected: `kanban server tests passed`.

## Task 4: Build Browser UI

**Files:**
- Create: `web/kanban/index.html`
- Create: `web/kanban/styles.css`
- Create: `web/kanban/app.js`
- Modify: `tests/kanban-server.test.js`

- [x] **Step 1: Add static UI assertions**

Extend `tests/kanban-server.test.js` to fetch `/`, `/styles.css`, and `/app.js`:

```js
const home = await fetch(info.url);
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /Agent Ops Kanban/);
assert.match(html, /id="task-drawer"/);

const css = await fetch(`${info.url}/styles.css`);
assert.equal(css.status, 200);

const js = await fetch(`${info.url}/app.js`);
assert.equal(js.status, 200);
```

- [x] **Step 2: Run test and verify RED**

Run:

```bash
node tests/kanban-server.test.js
```

Expected: fails until static UI files exist.

- [x] **Step 3: Implement static UI**

Use `docs/kanban/DESIGN.md` as the design contract.

Required elements:

- top bar with repo path, refresh, new task
- left filters
- four columns
- task drawer form
- inline error region
- loading skeleton region
- empty state

Do not add dependencies, icons, fake charts, or decorative animation.

- [x] **Step 4: Implement client JS**

In `web/kanban/app.js`:

- Fetch `/api/snapshot` on load and refresh.
- Render cards into columns.
- Open drawer for create/edit.
- Submit create/update requests.
- Submit claim and finish requests.
- Render errors inline with command and stderr excerpt.

- [x] **Step 5: Run test and verify GREEN**

Run:

```bash
node tests/kanban-server.test.js
```

Expected: server and static UI tests pass.

## Task 5: Wire CLI Command

**Files:**
- Modify: `bin/agent-ops.js`
- Modify: `tests/package-cli.test.js`
- Modify: `package.json`

- [x] **Step 1: Add failing CLI test**

In `tests/package-cli.test.js`, assert help includes kanban:

```js
assert.match(result.stdout, /agent-ops kanban/);
```

Also assert pack contains:

```js
'bin/kanban-server.js',
'web/kanban/index.html',
'web/kanban/styles.css',
'web/kanban/app.js'
```

- [x] **Step 2: Run test and verify RED**

Run:

```bash
node tests/package-cli.test.js
```

Expected: fails because help and package files do not include kanban.

- [x] **Step 3: Wire command**

In `bin/agent-ops.js`:

- Add `agent-ops kanban [--port <port>] [--no-open]`.
- Require initialized repo before launching.
- Spawn `bin/kanban-server.js` with current cwd.

In `package.json`:

- Add `bin/kanban-server.js` and `web/kanban/` to `files`.
- Add tests to `npm test`.

- [x] **Step 4: Run test and verify GREEN**

Run:

```bash
npm test
```

Expected: package CLI, kanban data, kanban server, shell, Python, and Agent Ops checks pass.

## Task 6: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/SETUP.md`
- Modify: `docs/plug-and-play.md`
- Modify: `docs/kanban/DESIGN.md` only if final UI deviates

- [x] **Step 1: Document command**

Add examples:

```bash
agent-ops kanban
agent-ops kanban --no-open
agent-ops kanban --port 4783
```

Explain:

- local-only server
- command-backed writes
- one active task rule
- v1 excludes drag-and-drop

- [x] **Step 2: Run full verification**

Run:

```bash
npm test
npm pack --dry-run
git diff --check
```

Expected:

- all tests pass
- pack includes kanban files
- pack excludes runtime `.ai/state` and task archives
- no whitespace errors

- [x] **Step 3: Manual browser verification**

Run:

```bash
agent-ops kanban --no-open
```

Open the printed URL and verify:

- board renders
- create backlog task works
- duplicate active task error is inline
- file claim works
- finish done with verification works
- mobile width does not horizontally overflow the page shell

## Risks

- Existing task markdown files are lightly structured. The parser should prefer
  JSON state and archive files where possible and tolerate markdown gaps.
- Updating active tasks has to keep three files in sync.
- A browser UI can imply multiple active tasks. The UI must keep the one active
  task rule visible.
- Local server must stay localhost-only by default.

## Execution Recommendation

Use inline execution unless splitting the work. If splitting, use two disjoint
lanes:

1. Data commands and tests: `scripts/agent-ops-tool.py`, `tests/kanban-data.test.js`.
2. Browser server and UI: `bin/kanban-server.js`, `web/kanban/*`, `tests/kanban-server.test.js`.

Do not run both lanes against `bin/agent-ops.js`, `package.json`, or README at
the same time. Serialize the final CLI and docs wiring.

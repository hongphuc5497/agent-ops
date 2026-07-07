# Changelog

All notable changes to Agent Ops are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

The kanban board now speaks the Astryx design language. The stylesheet's
token layer was replaced with values adapted from Meta's Astryx design system
(`@astryxdesign/theme-neutral`): a neutral near-black / near-white accent,
Astryx color families for the five board columns, Figtree typography, and
Astryx radii, shadows, and motion durations. Light and dark themes now
resolve from a single token set via CSS `light-dark()`, keyed off the
`color-scheme` value the existing theme toggle already flips — no JavaScript
changes. Figtree ships self-hosted alongside the board (SIL OFL), so the page
makes no external requests and works fully offline.

## 0.6.0 — 2026-07-06

The adoption release: Agent Ops becomes the fastest vendor-neutral way to
coordinate two AI coding agents in one repo — usable natively by agents that
never shell out, with claims enforced instead of trusted.

### Added

- **MCP server** — `agent-ops mcp [--repo <path>]` speaks stdio JSON-RPC and
  exposes `status`, `route`, `start`, `claim`, `release`, `handoff`, `finish`,
  `check`, and `doctor` as native MCP tools. Hand-rolled (zero runtime
  dependencies); every tool call runs the repo-vendored Python tool, so MCP
  results are exactly the CLI's JSON. Version skew between the npm package and
  the vendored tool surfaces in the `status` tool result. Setup for Claude
  Code and Codex: `.ai/integrations/templates/mcp/README.md`.
- **Pre-commit claim enforcement** — `agent-ops hook install` (with
  `uninstall` and `--dry-run`) writes a pre-commit hook that blocks commits
  touching files claimed by a different agent. The block message names the
  files, the owning agent, and the three ways out. Agent identity resolves
  from `AGENT_OPS_OWNER` (per-process) then `git config agent-ops.owner`
  (human fallback). One-time bypass: `AGENT_OPS_SKIP_HOOK=1` (logged).
  Refuses to clobber existing hooks (husky etc.) and works in worktrees.
  Backend: new `claims-check --stdin [-z]` subcommand reusing the glob-aware
  overlap logic — one Python spawn per commit regardless of size.
- **Crash recovery** — `agent-ops claim --release <paths>` (and
  `--release-all`) drops claims without finishing a task and works with no
  active task, which is the recovery case. Releasing another owner's claims
  requires `--force --reason` and appends an audit event to the handoff log.
  Partial release of multi-path claims supported. `doctor` now reports stale
  claims (older than `--staleness-hours`, default 24) and orphan claims
  (task neither active nor archived); `check` warns on orphans without
  failing.

### Changed

- **Locking is honest off-POSIX** — where `fcntl` is unavailable (Windows),
  state mutations are refused with a structured error naming
  `AGENT_OPS_UNSAFE_NO_LOCK=1` instead of silently running unlocked.
  Read-only commands (`status`, `check`, `doctor`) keep working. There is no
  Windows CI; this path is covered by an fcntl-import shim test.
- README leads with the two-agent coordination quickstart, documents the
  worktree tradeoff (new ADR-0006 in `.ai/DECISIONS.md`), and no longer says
  "Not an MCP server".
- `agent-ops help` lists the coordination environment variables.

### Also in this release (PR #13)

Claim conflicts are now glob-aware. Previously two agents could claim the same
files under different spellings — `tests/*` and `tests/foo.test.js` did not
conflict because the check compared exact strings only. `agent-ops claim` now
detects overlap when either path pattern matches the other, one is a
directory prefix of the other, or two globs share a prefix-compatible literal
stem (`web/kanban/*.js` vs `web/kanban/app.*`). Filesystem-equivalent
spellings (`./src/foo.ts`, `src/./foo.ts`, `lib/../src/foo.ts`, trailing
slashes) normalize to the same claim, and a claim on `.` covers the whole
repo. Divergent globs (`src/a*` vs `src/b*`) stay disjoint. Glob-vs-glob
detection is a conservative prefix heuristic, not full pattern intersection —
false positives err toward safety for a lock system.

Hardening from adversarial review (Claude + Codex): matching uses
`fnmatch.fnmatchcase` so verdicts don't vary by OS case-folding; empty or
whitespace-only claim paths are rejected before they reach the state file
(a stored empty path previously failed validation on every later read); and
the kanban snapshot caps handoffs at the last 20 entries instead of shipping
the unbounded log on every poll.

Also removed the literal `- TODO` placeholder that `create-task` left under
Acceptance Criteria in generated task files, matching the `start` template.

Added `tests/claim-overlap.test.js` covering glob-vs-literal, directory-prefix,
spelling normalization, dotfile safety, disjoint claims, and same-owner
extension.

Kanban UI: the Claims panel now shows each claim as a card with its owner
(avatar + name), path chips, and the owning task title (hover shows the claim reason) instead of
anonymous path chips. A new Handoffs panel shows the five most recent handoffs
(`from → to` with a timestamp; hover shows the description or acceptance
criteria) — the snapshot already carried this data but the UI never rendered
it. Claim-conflict errors in the task drawer now list which owner holds which
conflicting paths.

## 0.5.3 — 2026-06-22

Bug-fix release. `agent-ops init`/`upgrade` no longer corrupt an existing
`.ai/` allowlist in a target repo's `.gitignore`.

`ensure_gitignore` only recognized the blanket `.ai/` form, so a repo using the
v0.5.0 allowlist style (`.ai/*` followed by `!.ai/...` rules to commit some
`.ai/` source while ignoring runtime state) had a redundant blanket `.ai/`
appended on upgrade — which re-ignored the very files the `!` rules un-ignore.
The check now matches both `.ai/` and the `.ai/*` allowlist anchor and leaves an
allowlisted `.gitignore` untouched. Blanket and missing cases are unchanged.

Added `tests/gitignore.test.js` covering the allowlist, bare, and missing cases.

## 0.5.2 — 2026-06-22

Bug-fix release. `scripts/agent-ops-check.sh` no longer fails when a target
repo gitignores `.ai/` — the default layout produced by `agent-ops init`.

Previously `.ai/TASK.md`, `.ai/ROUTING.md`, `.ai/DECISIONS.md`, and the
`.ai/integrations/templates/**` files were listed as unconditional core files,
so the `Agent Ops Check` GitHub workflow failed on a clean CI checkout with
`missing required file: .ai/TASK.md` even though those paths are intentionally
gitignored. They now sit in the `.ai/protocol.md`-gated block: a repo that
commits its `.ai/` source still gets full validation, while a repo that
gitignores it (the default) skips the `.ai/` checks and passes.

Added `tests/clean-checkout.test.js`, which extracts the tracked tree with
`git archive` — exactly what CI checks out — and asserts the check passes, plus
a negative case proving a committed-but-incomplete `.ai/` still fails.

Run `agent-ops upgrade` in existing repos to pick up the tolerant check.

## 0.5.1 — 2026-06-20

Docs-only release. Every `npx @hongphuc5497/agent-ops` and
`npm install -g @hongphuc5497/agent-ops` example in `README.md`,
`docs/SETUP.md`, and `docs/plug-and-play.md` now uses the explicit
`@latest` dist-tag suffix. Equivalent semantics; bypasses npx's local
cache and signals intent more clearly to readers who copy-paste the
quick start.

No code, no behavior change. Cut as a patch release so the npm
package page reflects the updated install instructions immediately.

## 0.5.0 — 2026-06-20

**Breaking layout change.** Four Agent Ops top-level entries moved into
`.ai/`: `TASK.md`, `ROUTING.md`, `DECISIONS.md`, and the entire
`integrations/` directory. `agent-ops upgrade` auto-migrates existing
v0.4.x repos — content is preserved verbatim and `git mv` is used so file
history follows the rename.

### Why

The repo root collected Agent Ops files that didn't need to be there. After
the move, only files that **must** live at the root remain — universally-
recognized files (`README`, `LICENSE`, `package.json`), and files that
external tools look for by convention (`AGENTS.md` for Codex, `CLAUDE.md`
for Claude Code). Everything else now lives in `.ai/`, the working
directory of the protocol.

### Migration

```bash
# Existing v0.4.x install
agent-ops upgrade

# The output now includes "migrated X to .ai/X" lines. Content is preserved.
# Re-running upgrade is a no-op — the migration is idempotent.
```

`agent-ops doctor` flags any repo that still has the legacy layout, with a
remedy line pointing at `agent-ops upgrade`.

### What stays at root

| File | Why |
|---|---|
| `AGENTS.md` | Codex convention — looks for it at the root |
| `CLAUDE.md` | Claude Code convention — looks for it at the root |
| `README.md`, `LICENSE`, `package.json`, `.gitignore` | Universal |

### What moved into `.ai/`

| Old path | New path | Notes |
|---|---|---|
| `TASK.md` | `.ai/TASK.md` | User data — preserved on upgrade |
| `ROUTING.md` | `.ai/ROUTING.md` | Shipped content — refreshed on upgrade |
| `DECISIONS.md` | `.ai/DECISIONS.md` | User data — preserved on upgrade |
| `integrations/` | `.ai/integrations/templates/` | Shipped content — resolves the "two `integrations/`" naming collision (templates live next to runtime instances under one parent dir) |

### Added

- **Auto-migration** in `agent-ops upgrade` (`scripts/init-repo.sh`):
  detects legacy root files **and** the legacy `integrations/`
  directory, uses `git mv` when tracked (history follows the rename),
  falls back to plain `mv` otherwise. Dry-run mode reports the moves
  it would make without touching the repo.
- **`doctor.legacy_layout`** field — lists any of the three files still
  at root, with a `remedy` line telling the user how to migrate. Repos
  with legacy files at root are no longer reported as `ok: true`.
- **`tests/migrate.test.js`** — 5 cases covering the migration: full
  migration with preserved content, idempotent re-runs, doctor flagging,
  fresh-init layout, and dry-run safety.

### Changed

- `scripts/agent-ops-tool.py`: `TASK_MD`, new `ROUTING_MD`/`DECISIONS_MD`
  constants, `check_payload` looks at `.ai/` paths, `TOOL_VERSION` →
  `0.5.0`.
- `scripts/init-repo.sh`: `copy_files`/`generated_files` point at `.ai/`;
  `get_default_content` cases renamed.
- `scripts/agent-ops-check.sh`: `core_files` list updated.
- `integrations/{codex,claude,opencode}/...`: path references updated so
  installed `AGENTS.md`/`CLAUDE.md` rules tell each agent to read the
  new locations.
- `.gitignore`: `!.ai/ROUTING.md` (shipped content), plus `!.ai/TASK.md`
  and `!.ai/DECISIONS.md` for repos that commit their own (like this
  one).
- Docs across `README.md`, `docs/SETUP.md`, `docs/plug-and-play.md`,
  `docs/supported-integrations.md`, `docs/kanban/*.md` updated to the
  new paths.
- This repo (agent-ops itself) ate its own dog food via `git mv` on
  `TASK.md`, `ROUTING.md`, `DECISIONS.md`.

## 0.4.0 — 2026-06-20

Milestone 4: Smarter routing. Closes the weakest gap in the protocol surface
— the hardcoded English-only keyword table that decided which agent owned
every new task. Per-repo overrides are now an opt-in JSON file; existing
repos see zero behavior change.

### Added

- **`.ai/routing.json`** (opt-in) — per-repo routing rules. First match wins;
  unmatched descriptions fall through to the built-in keyword routes, so
  rules never make routing *worse* than the defaults. Match types in this
  release: `keyword` (case-insensitive substring) and `regex` (Python
  `re.search`). Combinator: `any:`. Partial route overrides supported —
  a rule that only sets `owner` keeps the default `workflow`,
  `verification`, and `advisor` fields.
- **`.ai/routing.example.json`** — annotated sample shipped via the npm
  package and copied into target repos by `agent-ops init`. Reproduces
  the built-in routes verbatim plus a custom "security" rule as a
  starting point.
- **[docs/routing.md](docs/routing.md)** — schema reference, validation
  errors, worked examples, what's deferred to a later release.
- **Structural validator** for the new file — surfaces specific problems
  with a `remedy` hint pointing at recovery, following the M1 validator
  pattern.

### Changed

- `infer_route()` is now config-then-fallback. The previous hardcoded
  routing logic is preserved verbatim in `_hardcoded_route()` for the
  fallback path.
- `TOOL_VERSION` bumped to 0.4.0.

### Tests

- `tests/routing.test.js` covers 8 cases: no file → hardcoded fallback,
  keyword match wins, regex match wins, no rule matches → fallback,
  partial override merges with hardcoded default, malformed JSON →
  typed error with remedy hint, invalid schema → validation problems
  list, rule order matters (first match wins).

### Deferred to M4.1

- `--route llm` mode for LLM-classified routing
- `all:` / `not:` combinators (schema-compatible additions)
- `agent-ops route add-rule` CLI for managing rules without hand-editing
- Routing history audit log

## 0.3.1 — 2026-06-20

Smoke-test of the new tag-driven release workflow ([#6](https://github.com/hongphuc5497/agent-ops/pull/6)). No behavior changes from 0.3.0 — this release exists to verify that pushing a `v*.*.*` tag publishes to npm via Trusted Publishing (OIDC) and updates the GitHub release in lockstep. If you're already on 0.3.0, there's nothing to upgrade for.

## 0.3.0 — 2026-06-20

Milestone 2: Onboarding velocity. Shaves the README's 5-minute quick start
to a single command and gives new users a guided way to learn the protocol
without risking real code.

### Added

- **`agent-ops init --interactive`** — picks agents to install and seeds an
  optional tutorial task in one shot. Replaces the previous chain of
  `init` + N × `install` + manual exploration.
- **`agent-ops tutorial`** — drops a guided demo task into `.ai/tasks/` and
  sets it as the active task. The task markdown walks through `claim`,
  `delegate`, and `finish` on fake paths so the user exercises the real
  commands without touching real code. Refuses if a task is already
  active.
- **Tutorial source** at `integrations/tutorial/first-task.md`, shipped
  with the npm package via the existing `integrations/` glob.
- **Reads-and-writes matrix** in `docs/supported-integrations.md` —
  explicit per-agent contract for what gets read, written, and never
  written. This is the boundary that makes Agent Ops a coordination tool
  instead of a chaos tool.

### Tests

- `tests/tutorial.test.js` — `agent-ops tutorial` creates the active task,
  the markdown matches the bundled content, the command refuses on an
  uninitialized repo or when another task is already active.
- `tests/interactive-init.test.js` — drives the interactive prompts via
  stdin, confirms both chosen agents get installed (via assertions on
  `AGENTS.md` / `CLAUDE.md`), confirms the tutorial is seeded when
  requested and skipped when declined, and confirms unknown agent names
  are rejected.

## 0.2.0 — 2026-06-19

Milestone 1: Reliability hardening. Closes the concurrency, validation, and
drive-by-POST gaps surfaced in the v0.1 code review.

### Added

- **State locking.** Every read-modify-write on `.ai/state/*.json` now holds
  an exclusive POSIX advisory lock on `.ai/state/.lock`. Two agents racing
  `claim` on the same path no longer both pass the conflict check — exactly
  one wins, the other sees a clean `claim conflict` error. Falls back to
  atomic-write-only on non-POSIX hosts.
- **Atomic JSON writes.** State files are written via temp file + `fsync` +
  `os.replace`, so a crash mid-write cannot leave a half-written claim or
  active task. JSONL handoffs continue to use `O_APPEND` (POSIX-atomic for
  small lines).
- **Structural state validation.** New inline validators for
  `active-task.json`, `file-claims.json`, and `handoffs.jsonl` surface
  specific problems (`claims[3].paths must be a non-empty array`) instead
  of stack traces or silent corruption.
- **CSRF protection on the kanban server.** A random per-process token is
  injected into `index.html` and required as `x-csrf-token` on every
  mutating request. A drive-by POST from any other page the user has open
  is rejected with a 403, even though the server binds loopback.
- **`agent-ops doctor` command.** New diagnostic that prints tool version,
  Python/Node/git versions, locking strategy, repo init status, and any
  state validation problems — designed to be pasted into a bug report.

### Changed

- All state-mutating commands (`start`, `claim`, `finish`, `handoff`,
  `delegate`, `update-task`) now run under the state lock.
- JSON read errors now include a `remedy` hint pointing at the file and
  the recovery path.
- Bumped the `ao` shell wrapper to `0.2.0`.

### Tests

- `tests/locking.test.js` — eight concurrent claimers with distinct owners
  produce exactly one winner.
- `tests/doctor.test.js` — shape contract for the doctor payload, and a
  case proving corrupt JSONL is reported with a line number.
- `tests/csrf.test.js` — POST without token → 403; with wrong token → 403;
  with correct token → 201. HTML response has the placeholder replaced.

## 0.1.0 — 2026-06-18

Initial public release. Repo-native coordination protocol for AI coding
agents, distributed as `@hongphuc5497/agent-ops`. File-first workflow with
optional localhost kanban UI. See [README.md](README.md) for the full
feature set at launch.

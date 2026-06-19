# Changelog

All notable changes to Agent Ops are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

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

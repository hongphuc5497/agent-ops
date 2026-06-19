# Changelog

All notable changes to Agent Ops are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

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

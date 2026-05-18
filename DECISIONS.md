# Decisions

## ADR-0001: Codex is the v1 workflow brain

Date: 2026-05-18
Status: accepted

Decision: Codex owns orchestration, active task state, implementation, and final
verification by default.

Reason: the current workflow already runs through Codex, and adding a separate
brain would increase context switching before the workflow has product proof.

Rejected:

- Dedicated custom orchestrator service.
- Hermes as canonical brain.
- Multi-agent default editing.

Review trigger: revisit only after three repeated workflows are blocked by
Codex being the owner.

## ADR-0002: Markdown before infrastructure

Date: 2026-05-18
Status: accepted

Decision: v1 uses markdown, JSON task state, and tiny scripts. No database,
server, dashboard, or agent bus.

Reason: the main problem is focus and repeatability, not missing infra.

Review trigger: add infrastructure only when the same manual step has been done
successfully at least five times and costs more than 15 minutes per week.

## ADR-0003: One active owner

Date: 2026-05-18
Status: accepted

Decision: every implementation task has one active owner. Other agents advise
or review unless ownership is explicitly transferred.

Reason: overlapping edits create hidden coordination cost and weak completion.

Review trigger: revisit only for independent file sets with automated conflict
checks.


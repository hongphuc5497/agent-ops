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

## ADR-0004: Separate install integrations from live coordination

Date: 2026-06-16
Status: accepted

Decision: Agent Ops treats install integrations and live coordination as
separate capabilities. `scripts/install-integration.sh` only writes the files an
agent reads. `TASK.md`, `.ai/state/*`, `ROUTING.md`, and `scripts/ao` define
ownership, handoffs, and verification once work starts.

Reason: AI DevKit shows that agent setup and live agent control are different
systems with different support matrices. Importing that boundary keeps Agent
Ops boring and avoids implying that a template-only integration can be remotely
controlled or inspected.

Rejected:

- Adding a package-style environment registry before repeated manual demand.
- Treating every installed integration as an implementation-capable owner.
- Adding a daemon or database to track live sessions in v1.

Review trigger: revisit only after three integrations need the same generated
metadata or live session control is blocked by the file-first protocol.

## ADR-0005: npm package is a distribution adapter

Date: 2026-06-16
Status: accepted

Decision: Agent Ops can be distributed as a dependency-free npm package with a
thin `agent-ops` binary. The binary seeds protocol files with `agent-ops init`
and delegates ongoing commands to the repo-local scripts after initialization.

Reason: AI DevKit's `npx ... init` flow is easier to adopt than cloning a repo
and manually running shell scripts. Keeping npm as a wrapper preserves the
file-first architecture: the installed package is only the delivery vehicle,
while initialized repos still own their protocol files and task state.

Rejected:

- Replacing the repo-local scripts with a Node runtime.
- Adding npm dependencies for command routing.
- Mutating global agent config during package install.

Review trigger: revisit only if packaging creates repeated drift between the
npm binary and repo-local `scripts/ao` behavior.

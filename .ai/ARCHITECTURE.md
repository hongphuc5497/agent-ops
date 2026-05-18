# AI Workflow Orchestration Architecture

Goal: build reliable AI-native developer workflows for indie developers.

Non-goal: build another generic agent framework.

## 1. Workflow Architecture

### V1 Architecture

```text
TASK.md + ROUTING.md + DECISIONS.md + .ai/protocol.md
        |
        v
Codex = brain + operator + default implementer
        |
        +-- Augment = codebase map and impact intelligence
        +-- OpenClaw = product/review critic
        +-- OpenCode = isolated implementation lane
        +-- Hermes = background automation + notifications
        +-- GitHub Actions = remote verification
        +-- Local LLMs = cheap draft/classification worker
```

### Role Choices

Codex is the brain because it can inspect, edit, verify, use memory, and finish
repo work in one loop. This reduces context switching.

Codex is also the default implementer. Splitting brain and implementer too early
creates handoff overhead. Use OpenCode only when the work is isolated by file
ownership.

OpenClaw is the reviewer for product judgment, plan pressure, and taste. It
should challenge scope and market logic, not own code.

Augment is the codebase navigator. It answers "where is this behavior?" and
"what depends on this?" before edits.

Memory is repo markdown plus Codex durable memory. Hermes state is useful for
status checks but not canonical memory.

Notifications are Hermes locally and GitHub Actions remotely.

### Integration-First Shape

```text
Agent Ops Protocol
  - task state
  - file claims
  - routing rules
  - handoff records
  - verification gates

Integration Surfaces
  - AGENTS.md / instruction templates
  - JSON tool bridge
  - future MCP server
  - GitHub Action
  - optional dashboard
```

The CLI exists for humans and scripts, but the product surface is the protocol
agents can use from inside their normal workflow.

### Why Not More Infra

The current bottleneck is not agent capability. It is unclear ownership,
repeated decisions, scattered experiments, and no hard stop for fake progress.
Markdown and tiny scripts solve the bottleneck first.

## 2. Agent Routing System

### Task Classes

| Task Type | Owner | Advisors | Verification |
| --- | --- | --- | --- |
| Repo feature | Codex | Augment, OpenClaw | tests, lint, build |
| Bug/debug | Codex | Augment | repro, targeted test |
| CI failure | Codex | GitHub Actions logs, Augment | rerun failing check |
| Architecture decision | Codex | OpenClaw | ADR accepted |
| Experiment | Codex | local LLM draft ok | written score + kill date |
| Scheduled automation | Hermes | Codex | latest run artifact |
| Isolated script patch | OpenCode | Codex reviews | script dry run |

### Deterministic Flow

1. Start task with `./scripts/task-start.sh`.
2. Identify task class from the table.
3. Assign one owner.
4. Ask advisors only for bounded outputs.
5. Edit only owner-approved files.
6. Verify.
7. Write decision/memory if the result should compound.
8. Finish task with `./scripts/task-finish.sh done`.

### Ownership Boundary Examples

Good split:

- Codex owns `.ai/ARCHITECTURE.md`.
- OpenCode owns `scripts/task-status.sh`.
- OpenClaw reviews product positioning only.

Bad split:

- Codex and OpenCode both "clean up docs".
- Hermes edits files while Codex edits the same workflow.
- OpenClaw rewrites implementation docs while reviewing them.

## 3. Repo / Workspace Structure

```text
agent-ops/
  AGENTS.md
  README.md
  TASK.md
  ROUTING.md
  DECISIONS.md
  .ai/
    ARCHITECTURE.md
    parking-lot.md
    state/
      active-task.json
      file-claims.json
      handoffs.jsonl
    schema/
      task.schema.json
      file-claims.schema.json
      handoff.schema.json
    protocol.md
    tasks/
      archive/
    workflows/
      daily.md
      feature.md
      debugging.md
      ci-failure.md
      review.md
      experimentation.md
    automation/
      README.md
    prompts/
      codex-owner.md
      augment-discovery.md
      openclaw-review.md
      opencode-delegate.md
      hermes-notification.md
    memory/
      README.md
      patterns.md
      weekly-log.md
    experiments/
      README.md
    templates/
      task.md
      decision.md
      project-score.md
  scripts/
    agent-ops-check.sh
    agent-ops-tool.py
    install-integration.sh
    task-start.sh
    task-status.sh
    task-finish.sh
    weekly-review.sh
```

### Protocol Contents

`.ai/protocol.md` defines the contract every agent follows: check status, claim
files, avoid overlapping ownership, log handoffs, verify before finishing.

### TASK.md Contents

`TASK.md` is the visible task lock. It should answer:

- What is active?
- Who owns it?
- What files are in scope?
- What verifies completion?
- What is explicitly out of scope?

### DECISIONS.md Contents

`DECISIONS.md` holds only decisions that change future behavior. It is not a
diary. If it does not affect future routing, product direction, or workflow, do
not add it.

## 4. Operational Workflow

### Daily Workflow

1. Run `./scripts/task-status.sh`.
2. If no task is active, pick one from `.ai/experiments/README.md`,
   `.ai/parking-lot.md`, or current product work.
3. Start the task.
4. Work one concern to done.
5. Verify.
6. Log durable learning in `.ai/memory/weekly-log.md` only if reusable.
7. Finish the task.

### Feature Workflow

1. Define user pain in one sentence.
2. Write acceptance criteria.
3. Ask Augment for code surface if touching an existing repo.
4. Decide owner and file set.
5. Add or update tests first when behavior is risky.
6. Implement.
7. Verify runtime surface.
8. Update memory or decision docs only if future behavior changes.

### Debugging Workflow

1. Reproduce the failure.
2. Capture exact command, input, and observed output.
3. Ask Augment where the behavior lives.
4. Form one root-cause hypothesis.
5. Add regression test or minimal repro.
6. Fix.
7. Rerun the failing command.

### CI Failure Workflow

1. Get failing job and exact log excerpt.
2. Reproduce locally when possible.
3. Patch smallest failing surface.
4. Run matching local command.
5. Push or rerun CI only after local evidence.

### Review Workflow

1. Codex checks behavior and tests.
2. OpenClaw checks product/scope/taste.
3. CI checks remote regression.
4. Findings must include file path, line or section, risk, and fix.

### Experimentation Workflow

1. Write hypothesis.
2. Set kill date.
3. Define max time box.
4. Define evidence required to continue.
5. Run the smallest demo.
6. Kill, park, or promote.

## 5. Indie Dev Focus System

### Anti-Chaos Rules

- One active task.
- One active product bet.
- Max two active experiments.
- Every experiment has a kill date.
- New repos require a written reason in `.ai/experiments/README.md`.
- No automation until the manual workflow succeeds twice.
- No product build until a painful repeated workflow is documented.

### Project Scoring

Score 1-5:

- Pain: how sharp is the user pain?
- Frequency: how often does it occur?
- Buyer: who pays?
- Speed: can MVP ship in 14 days?
- Distribution: can you reach users without paid ads?
- Compounding: does each use improve assets, memory, prompts, or data?
- Maintenance: can one person support it?

Continue threshold: 24 or higher out of 35.

Kill if:

- No clear buyer.
- No repeated personal pain.
- More than 14 days to a credible MVP.
- Requires building a broad platform first.
- You cannot explain the user workflow in one sentence.

### Weekly Review

Run:

```bash
./scripts/weekly-review.sh
```

Decide:

- Continue: evidence improved.
- Park: useful but not now.
- Kill: no buyer, no usage, or too much scope.

## 6. Product Direction

### Best Niche

Focus on "AI workflow reliability for solo and small-team developers who already
use coding agents but cannot keep work focused, reviewed, and repeatable."

This is better than generic model routing because the pain is immediate:
developers already have agents, but they do not trust the workflow.

### First Product Wedge

Build an "AI Task Control Plane" for indie devs:

- Markdown task lock.
- Agent routing rules.
- Handoff templates.
- CI/review workflow.
- Weekly focus scoring.
- Optional GitHub Action that checks task discipline.

Do not start with a hosted dashboard. Start with a repo template and CLI.

### Monetizable Products

1. Paid repo template + CLI: "Agent Ops Kit".
2. GitHub Action: verifies active task, decision records, and review evidence.
3. Consulting package: install reliable AI workflow in one repo.
4. Local-first desktop/notifier: Hermes-backed task reminders and stale-task alerts.
5. Team version later: multi-agent ownership and audit trail.

### Realistic First Customers

- Indie hackers using Codex, Cursor, Augment, or OpenCode.
- Small dev shops adopting AI agents but afraid of messy diffs.
- Technical founders with many side projects and weak focus.
- Open-source maintainers who want repeatable AI contribution workflows.

### MVP

Ship a public repo template:

- `TASK.md`
- `ROUTING.md`
- `DECISIONS.md`
- scripts for active task lock
- GitHub Action for "one active task" discipline
- sample workflows
- 10-minute setup guide

Price later after proof:

- Free repo template.
- Paid CLI or Pro templates for $29-$99.
- Setup service for $500-$2,000.

## 7. Execution Plan

### 14-Day Plan

Day 1:

- Seed this repo.
- Use it for one real task.
- Fix obvious friction.
- Add protocol, schemas, integration templates, and JSON bridge.

Day 2:

- Add a GitHub repo template README.
- Record a 10-minute "before/after" workflow.
- Run weekly scoring on current project ideas.

Day 3:

- Add a GitHub Action that checks `TASK.md`, `ROUTING.md`, and `DECISIONS.md`
  exist and that no active task is stale.
- Add a future MCP wrapper only if the JSON bridge proves useful.

Day 4:

- Use the workflow on a real coding task in another repo.
- Capture the handoff and verification evidence.

Day 5:

- Write a public case study: "How I stopped AI agents from fighting my repo."

Day 6:

- Package v0.1 as a template repo.
- Add setup script.

Day 7:

- Ask 5 indie devs to try it.
- Watch where they get confused.

Day 8:

- Add only the docs/scripts needed to fix onboarding confusion.

Day 9:

- Build the first GitHub Action check.

Day 10:

- Add examples for Codex, Augment, OpenCode, OpenClaw, and Hermes.

Day 11:

- Publish a short demo video.

Day 12:

- Add one paid offer page or README section.

Day 13:

- Run dogfood on another real repo.

Day 14:

- Decide: continue, park, or kill based on usage and feedback.

### Build First

1. Protocol and schemas.
2. JSON tool bridge for agents.
3. Integration templates.
4. GitHub Action check.
5. Dogfood case study.

### Ignore For Now

- Hosted dashboard.
- Model-router service.
- Multi-agent database.
- Complex memory embeddings.
- Agent marketplace.
- Slack/Discord bot.
- Browser UI.
- Full MCP server before the bridge is proven.

### Technical Priorities

- Make task ownership obvious.
- Make handoffs copy-pasteable.
- Make verification hard to skip.
- Make experiment kill decisions normal.

### Distribution Priorities

- Dogfood publicly.
- Write concrete teardown posts.
- Share before/after messy workflow examples.
- Offer setup help to indie devs already using agents.

# Custom Routing

Agent Ops routes new tasks to an owner + workflow via `infer_route()`. By
default that's a built-in keyword table optimized for the reference agents
(Codex, Claude, OpenClaw, etc.). You can override it per-repo by adding
`.ai/routing.json`.

The file is **opt-in**. Repos without it use the built-in defaults — zero
behavior change.

## When you'd want this

- You only use one or two agents (e.g., just Claude) and want every task
  routed to that agent regardless of keywords.
- Your task descriptions are in a language other than English.
- You want a category the built-ins don't have (e.g., "security audits get
  routed to a specific reviewer with extra rigor").
- You want `fix` or `patch` to count as debugging, not as the default
  feature workflow.

## Quick start

```bash
# Copy the bundled example — it exactly reproduces the built-in routes
# plus one custom "security" rule. Run agent-ops doctor to confirm.
cp .ai/routing.example.json .ai/routing.json

# Edit to taste, then verify
agent-ops route "fix the auth bug"        # uses your rules
agent-ops doctor                          # surfaces routing.json health
```

To revert to built-in routing, just delete the file.

## Schema

```json
{
  "rules": [
    {
      "name": "ci-failure",
      "when": {
        "any": [
          { "keyword": "ci" },
          { "keyword": "github action" },
          { "regex": "check.*failed" }
        ]
      },
      "route": {
        "type": "ci-failure",
        "owner": "Codex",
        "advisor": "GitHub Actions logs, Augment",
        "workflow": ".ai/workflows/ci-failure.md",
        "verification": "reproduce failing check locally, patch, rerun"
      }
    }
  ]
}
```

### `rules[]`

Walked in order, **first match wins**. If no rule matches, the built-in
keyword routes apply as a final fallback — so adding a rule never makes
your routing *worse* than the defaults.

### `rule.name` (required)

Short identifier. Becomes the route's `type` field unless `route.type` is
also set. Use it to find which rule fired in `agent-ops doctor` output.

### `rule.when` (required)

Match clause. Only the `any` combinator is supported in v0.4.0:

- `when.any` — array of matchers. The rule matches if **any one**
  matcher matches.

Future versions may add `all` and `not` combinators without breaking the
schema.

### Matchers

| Type | Field | Behavior |
|---|---|---|
| Keyword | `keyword` | Case-insensitive substring match |
| Regex | `regex` | Python `re.search` against the original description |

Exactly one of `keyword` or `regex` per matcher. For case-insensitive
regex, use an inline flag (`(?i)`) — the matcher does not normalize case
for you.

### `rule.route` (required)

The route to return when the rule matches. Any of these fields can be
set; missing fields are filled in from the **built-in route for the same
description** so partial overrides work cleanly:

| Field | Type | Notes |
|---|---|---|
| `type` | string | Route category. Defaults to `rule.name`. |
| `owner` | string | Agent name (e.g., `Codex`, `Claude`, `OpenClaw`). |
| `advisor` | string | Free-text — who else to consult. |
| `workflow` | string | Path to a workflow markdown file. |
| `verification` | string | What "done" looks like for this route. |

#### Partial override example

You want every task routed to Claude (your only agent), but you want
keyword-based routing for the rest of the fields:

```json
{
  "rules": [
    {
      "name": "default-owner",
      "when": { "any": [{ "regex": ".*" }] },
      "route": { "owner": "Claude" }
    }
  ]
}
```

This matches every description, sets `owner` to Claude, and lets the
built-in defaults fill in `workflow`, `verification`, and `advisor` based
on the description.

## Validation

`.ai/routing.json` is validated on every `agent-ops route`, `start`,
`create-task`, and `delegate` call. If anything's wrong, the command
exits non-zero with a structured error:

```json
{
  "ok": false,
  "error": ".ai/routing.json failed validation",
  "problems": [
    "rules[0].when.any[2].regex is invalid: missing ), unterminated subpattern"
  ],
  "remedy": "fix the listed problems in .ai/routing.json, or delete the file to fall back to the built-in routes"
}
```

`agent-ops doctor` also surfaces routing problems alongside other state
file health checks — so a broken routing file gets caught the first time
someone runs the diagnostic.

## What this does NOT do (yet)

Deferred to a future release:

- **LLM-routed mode.** `agent-ops start --route llm "..."` calling a small
  model to classify. Useful when keyword/regex rules don't cover your
  domain. Off-by-default opt-in once shipped.
- **`all:` and `not:` combinators.** v0.4.0 ships `any:` only.
- **`agent-ops route add-rule` CLI.** For now, edit the JSON by hand.
- **Routing history audit log.** Every routing decision logged for later
  review.

These additions will be schema-compatible — your v0.4.0 `routing.json`
will keep working unchanged.

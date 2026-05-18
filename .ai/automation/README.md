# Automation

Automation is allowed only after the manual workflow is useful.

## Current Automations

| Automation | Surface | Purpose |
| --- | --- | --- |
| agent-ops-check | local script + GitHub Actions | Verify required control-plane files and stale active task state |
| weekly-review | local script | Create weekly focus review template |

## Promotion Rule

Create automation when:

- the manual workflow succeeded at least twice
- the trigger is clear
- the output is reviewed by the active owner
- failure produces a concrete next action

Do not automate vague research, product judgment, or risky edits.

